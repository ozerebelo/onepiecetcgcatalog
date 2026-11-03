-- =============================================================================
-- Card catalog: sets (products), cards (game identity) and printings (physical
-- versions a player can own). Written only by the ingest job (service role /
-- direct Postgres connection); readable by everyone, signed in or not.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Search helpers
-- -----------------------------------------------------------------------------

-- Lower-cases and turns ASCII punctuation into spaces so that
-- "Monkey.D.Luffy", "monkey d luffy" and "OP01-016" / "op01 016" all compare equal.
-- Only ASCII punctuation is stripped, so Japanese text passes through intact.
create or replace function public.search_normalize(input text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(lower(coalesce(input, '')), '[[:punct:][:space:]]+', ' ', 'g'));
$$;

create or replace function public.card_search_text(
  card_id text, name_en text, name_ja text, types text[]
)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select public.search_normalize(
    concat_ws(' ', card_id, name_en, name_ja, array_to_string(types, ' '))
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.sets (
  id             text primary key,                    -- "<language>-<source_id>", e.g. en-569101
  language       text not null check (language in ('en', 'ja')),
  source_id      text not null,                       -- official card-list product id
  code           text not null,                       -- OP-01, ST-10, EB-02, P ...
  name           text not null,
  kind           text not null check (kind in ('booster', 'extra', 'premium', 'starter', 'promo', 'other')),
  sort_order     integer not null,
  printing_count integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (language, source_id),
  check (id = language || '-' || source_id)
);

create table public.cards (
  id           text primary key check (id ~ '^[A-Z]+([0-9]{2})?-[0-9]{3}$'),
  name_en      text,
  name_ja      text,
  name         text generated always as (coalesce(name_en, name_ja)) stored,
  category     text not null check (category in ('Leader', 'Character', 'Event', 'Stage', 'Don')),
  colors       text[] not null default '{}'
               check (colors <@ array['Red', 'Green', 'Blue', 'Purple', 'Black', 'Yellow']),
  cost         integer,
  power        integer,
  counter      integer,
  attributes   text[] not null default '{}',
  types        text[] not null default '{}',
  effect       text,
  trigger      text,
  effect_ja    text,
  trigger_ja   text,
  block_number integer,
  search_text  text generated always as (public.card_search_text(id, name_en, name_ja, types)) stored,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (name_en is not null or name_ja is not null)
);

create table public.printings (
  id            text primary key,                     -- "<language>:<code>", e.g. en:OP01-016_p3
  card_id       text not null references public.cards (id) on update cascade on delete restrict,
  language      text not null check (language in ('en', 'ja')),
  code          text not null,
  variant       text not null check (variant in ('base', 'parallel', 'reprint')),
  variant_index integer not null default 0 check (variant_index >= 0),
  set_id        text not null references public.sets (id) on update cascade on delete restrict,
  rarity        text not null check (rarity in (
                  'Leader', 'Common', 'Uncommon', 'Rare', 'SuperRare', 'SecretRare',
                  'Special', 'TreasureRare', 'Promo')),
  name          text not null,
  image_url     text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (language, code),
  check (id = language || ':' || code),
  -- code = card id + optional _p<n> (parallel) / _r<n> (reprint) suffix, consistent with variant columns
  check (code ~ '^[A-Z]+([0-9]{2})?-[0-9]{3}(_[pr][0-9]+)?$'),
  check (split_part(code, '_', 1) = card_id),
  check (
    case variant
      when 'base' then code = card_id and variant_index = 0
      when 'parallel' then code = card_id || '_p' || variant_index
      when 'reprint' then code = card_id || '_r' || variant_index
    end
  )
);

-- Bookkeeping for the ingest job, so the app can show "card data updated <date>".
create table public.ingest_runs (
  id              bigint generated always as identity primary key,
  source          text not null,
  source_revision text,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  stats           jsonb not null default '{}'
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index cards_search_text_trgm on public.cards using gin (search_text extensions.gin_trgm_ops);
create index cards_colors_idx on public.cards using gin (colors);
create index cards_category_idx on public.cards (category);
create index printings_card_id_language_idx on public.printings (card_id, language);
create index printings_set_id_idx on public.printings (set_id);
create index sets_language_kind_idx on public.sets (language, kind);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

create trigger sets_updated_at before update on public.sets
  for each row execute function public.set_updated_at();
create trigger cards_updated_at before update on public.cards
  for each row execute function public.set_updated_at();
create trigger printings_updated_at before update on public.printings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Access: public read, no client writes.
-- RLS is the real gate; the explicit grants/revokes make intent obvious and do
-- not depend on the project's default privileges.
-- -----------------------------------------------------------------------------

alter table public.sets enable row level security;
alter table public.cards enable row level security;
alter table public.printings enable row level security;
alter table public.ingest_runs enable row level security;

create policy "Catalog sets are public" on public.sets
  for select to anon, authenticated using (true);
create policy "Catalog cards are public" on public.cards
  for select to anon, authenticated using (true);
create policy "Catalog printings are public" on public.printings
  for select to anon, authenticated using (true);
create policy "Ingest runs are public" on public.ingest_runs
  for select to anon, authenticated using (true);

revoke all on public.sets, public.cards, public.printings, public.ingest_runs from anon, authenticated;
grant select on public.sets, public.cards, public.printings, public.ingest_runs to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Search
-- -----------------------------------------------------------------------------

-- One row per matching card, with a representative image chosen from the
-- caller's preferred language (first element of p_languages), base art first.
-- Every whitespace-separated query token must appear somewhere in the card's
-- number, English name, Japanese name or types.
create or replace function public.search_cards(
  p_query      text    default null,
  p_languages  text[]  default null,   -- only cards printed in these languages; null = all
  p_set_id     text    default null,   -- only cards with a printing in this set
  p_colors     text[]  default null,   -- card has ANY of these colors
  p_categories text[]  default null,
  p_rarities   text[]  default null,   -- card has a printing (in p_languages) with one of these rarities
  p_cost_min   integer default null,
  p_cost_max   integer default null,
  p_sort       text    default 'relevance',  -- relevance | number | name | cost
  p_limit      integer default 60,
  p_offset     integer default 0
)
returns table (
  id             text,
  name           text,
  name_en        text,
  name_ja        text,
  category       text,
  colors         text[],
  cost           integer,
  power          integer,
  counter        integer,
  types          text[],
  image_url      text,
  printing_count bigint,
  total_count    bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      public.search_normalize(p_query) as nq,
      lower(btrim(coalesce(p_query, ''))) as raw_q
  ),
  tokens as (
    select coalesce(array_agg(t), '{}') as list
    from params, unnest(string_to_array(params.nq, ' ')) as t
    where t <> ''
  ),
  matches as (
    select c.*,
      -- Relevance is only computed for text searches (the CASE short-circuits per row).
      case
        when (select nq from params) = '' then 2
        when lower(c.id) = (select raw_q from params) then 0
        when (select nq from params) in (public.search_normalize(c.name_en), public.search_normalize(c.name_ja)) then 1
        else 2
      end as rank,
      -- Closer / shorter names first: "luffy" ranks Monkey.D.Luffy above
      -- "Luffy Is the Man Who Will Become the King of Pirates!!!".
      case
        when (select nq from params) = '' then 0
        else greatest(
          extensions.similarity(public.search_normalize(c.name_en), (select nq from params)),
          extensions.similarity(public.search_normalize(c.name_ja), (select nq from params))
        )
      end as similarity
    from public.cards c
    where
      (select cardinality(list) from tokens) = 0
      or not exists (
        select 1 from unnest((select list from tokens)) as t
        where c.search_text not like '%' || t || '%'
      )
  ),
  filtered as (
    select m.*
    from matches m
    where (p_colors is null or m.colors && p_colors)
      and (p_categories is null or m.category = any (p_categories))
      and (p_cost_min is null or m.cost >= p_cost_min)
      and (p_cost_max is null or m.cost <= p_cost_max)
      and exists (
        select 1 from public.printings p
        where p.card_id = m.id
          and p.language = any (coalesce(p_languages, array['en', 'ja']))
          and (p_set_id is null or p.set_id = p_set_id)
          and (p_rarities is null or p.rarity = any (p_rarities))
      )
  ),
  ranked as (
    select f.*,
      count(*) over () as total_count,
      row_number() over (
        order by
          case when p_sort = 'relevance' then f.rank end,
          case when p_sort = 'relevance' then f.similarity end desc nulls last,
          case when p_sort = 'name' then f.name end,
          case when p_sort = 'cost' then f.cost end nulls last,
          f.id
      ) as position
    from filtered f
  ),
  page as (
    select * from ranked
    order by position
    limit least(greatest(coalesce(p_limit, 60), 1), 200)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  -- Per-card lookups run for the returned page only, not for every match.
  select
    pg.id, pg.name, pg.name_en, pg.name_ja, pg.category, pg.colors, pg.cost, pg.power, pg.counter, pg.types,
    rep.image_url,
    (select count(*) from public.printings p
      where p.card_id = pg.id and p.language = any (coalesce(p_languages, array['en', 'ja']))) as printing_count,
    pg.total_count
  from page pg
  cross join lateral (
    select p.image_url
    from public.printings p
    where p.card_id = pg.id
      and p.language = any (coalesce(p_languages, array['en', 'ja']))
    order by
      array_position(coalesce(p_languages, array['en', 'ja']), p.language),
      (p.variant <> 'base'),
      p.variant_index,
      p.code
    limit 1
  ) rep
  order by pg.position;
$$;

grant execute on function public.search_cards(text, text[], text, text[], text[], text[], integer, integer, text, integer, integer)
  to anon, authenticated;
