-- =============================================================================
-- Milestone 5: meta decks and suggestions.
--
-- Reference tournament lists, curated by us from public results and credited to
-- where they were published (packages/ingest/meta/meta-decks.json, loaded by
-- `pnpm ingest --meta-only`). Public to read, written only by the importer.
--
-- Ownership is counted like everywhere else: per card, across every printing
-- (alt arts included) of ONE card language. Signed out, everything is "missing".
-- =============================================================================

create table public.meta_decks (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  archetype      text not null check (char_length(btrim(archetype)) between 1 and 80),
  leader_card_id text not null references public.cards (id) on update cascade on delete restrict,
  format         text not null check (format ~ '^(OP|EB|ST|PRB)[0-9]{2}(\.[0-9])?$'),
  event          text not null check (char_length(btrim(event)) between 1 and 160),
  event_date     date not null,
  placement      integer check (placement > 0),
  players        integer check (players > 0),
  player         text check (char_length(player) <= 80),
  region         text check (char_length(region) <= 80),
  source_name    text not null check (char_length(btrim(source_name)) between 1 and 80),
  source_url     text not null check (source_url ~ '^https://'),
  card_count     integer not null default 0 check (card_count >= 0),
  updated_at     timestamptz not null default now()
);

create table public.meta_deck_cards (
  meta_deck_id uuid not null references public.meta_decks (id) on delete cascade,
  card_id      text not null references public.cards (id) on update cascade on delete restrict,
  quantity     integer not null check (quantity between 1 and 50),
  primary key (meta_deck_id, card_id)
);

create index meta_decks_leader_idx on public.meta_decks (leader_card_id);
create index meta_decks_date_idx on public.meta_decks (event_date desc);
create index meta_deck_cards_card_idx on public.meta_deck_cards (card_id);

alter table public.meta_decks enable row level security;
alter table public.meta_deck_cards enable row level security;

create policy "Meta decks are public" on public.meta_decks for select to anon, authenticated using (true);
create policy "Meta deck cards are public" on public.meta_deck_cards for select to anon, authenticated using (true);

revoke all on public.meta_decks, public.meta_deck_cards from anon, authenticated;
grant select on public.meta_decks, public.meta_deck_cards to anon, authenticated;

-- -----------------------------------------------------------------------------
-- What the signed-in user owns of each card, in one language (empty when signed out).
-- SECURITY DEFINER only so signed-out visitors (who can't read collection_items) get an
-- empty result instead of a permission error; it never returns anyone else's rows.
-- -----------------------------------------------------------------------------
create or replace function public.owned_card_totals(p_language text)
returns table (card_id text, owned integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.card_id, sum(ci.quantity)::integer
  from public.collection_items ci
  join public.printings p on p.id = ci.printing_id
  where ci.user_id = (select auth.uid())
    and p.language = p_language
  group by p.card_id;
$$;

-- -----------------------------------------------------------------------------
-- Every meta deck with how much of it you own: "What can you build".
-- -----------------------------------------------------------------------------
create or replace function public.meta_deck_progress(p_language text default 'en')
returns table (
  id             uuid,
  slug           text,
  archetype      text,
  leader_card_id text,
  leader_name    text,
  leader_colors  text[],
  leader_image   text,
  format         text,
  event          text,
  event_date     date,
  placement        integer,
  players        integer,
  player         text,
  region         text,
  source_name    text,
  source_url     text,
  needed         integer,
  have           integer,
  missing        integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with owned as (select * from public.owned_card_totals(p_language)),
  progress as (
    select mdc.meta_deck_id,
           sum(mdc.quantity)::integer as needed,
           sum(least(mdc.quantity, coalesce(o.owned, 0)))::integer as have
    from public.meta_deck_cards mdc
    left join owned o on o.card_id = mdc.card_id
    group by mdc.meta_deck_id
  )
  select m.id, m.slug, m.archetype, m.leader_card_id, c.name, c.colors,
         (select p.image_url from public.printings p
           where p.card_id = m.leader_card_id
           order by (p.language <> p_language), (p.variant <> 'base'), p.variant_index
           limit 1),
         m.format, m.event, m.event_date, m.placement, m.players, m.player, m.region, m.source_name, m.source_url,
         coalesce(pr.needed, 0), coalesce(pr.have, 0), coalesce(pr.needed, 0) - coalesce(pr.have, 0)
  from public.meta_decks m
  join public.cards c on c.id = m.leader_card_id
  left join progress pr on pr.meta_deck_id = m.id
  order by m.event_date desc, m.placement nulls last, m.archetype;
$$;

-- -----------------------------------------------------------------------------
-- "Best next pickups": the cards you're missing that the most meta decks play.
-- decks_finished counts the decks this card would complete on its own (it's the
-- only card they still miss).
-- -----------------------------------------------------------------------------
create or replace function public.meta_pickups(p_language text default 'en', p_limit integer default 12)
returns table (
  card_id        text,
  name           text,
  category       text,
  colors         text[],
  cost           integer,
  image_url      text,
  owned          integer,
  copies         integer,
  decks          integer,
  decks_finished integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with owned as (select * from public.owned_card_totals(p_language)),
  gaps as (
    select mdc.meta_deck_id, mdc.card_id, mdc.quantity - coalesce(o.owned, 0) as short
    from public.meta_deck_cards mdc
    left join owned o on o.card_id = mdc.card_id
    where mdc.quantity > coalesce(o.owned, 0)
  ),
  only_gap as (
    select meta_deck_id from gaps group by meta_deck_id having count(*) = 1
  )
  select g.card_id, c.name, c.category, c.colors, c.cost,
         (select p.image_url from public.printings p
           where p.card_id = g.card_id
           order by (p.language <> p_language), (p.variant <> 'base'), p.variant_index
           limit 1),
         coalesce(max(o.owned), 0)::integer,
         max(g.short)::integer,
         count(*)::integer,
         count(*) filter (where g.meta_deck_id in (select meta_deck_id from only_gap))::integer
  from gaps g
  join public.cards c on c.id = g.card_id
  left join owned o on o.card_id = g.card_id
  group by g.card_id, c.name, c.category, c.colors, c.cost
  order by count(*) filter (where g.meta_deck_id in (select meta_deck_id from only_gap)) desc,
           count(*) desc, max(g.short), g.card_id
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;

-- -----------------------------------------------------------------------------
-- One meta deck, card by card, with what you own (works signed out: have = 0).
-- -----------------------------------------------------------------------------
create or replace function public.meta_deck_check(p_meta_deck_id uuid, p_language text default 'en')
returns table (
  card_id   text,
  name      text,
  category  text,
  colors    text[],
  cost      integer,
  image_url text,
  needed    integer,
  owned     integer,
  have      integer,
  missing   integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with owned as (select * from public.owned_card_totals(p_language))
  select mdc.card_id, c.name, c.category, c.colors, c.cost,
         (select p.image_url from public.printings p
           where p.card_id = mdc.card_id
           order by (p.language <> p_language), (p.variant <> 'base'), p.variant_index
           limit 1),
         mdc.quantity,
         coalesce(o.owned, 0),
         least(mdc.quantity, coalesce(o.owned, 0)),
         mdc.quantity - least(mdc.quantity, coalesce(o.owned, 0))
  from public.meta_deck_cards mdc
  join public.cards c on c.id = mdc.card_id
  left join owned o on o.card_id = mdc.card_id
  where mdc.meta_deck_id = p_meta_deck_id
  order by array_position(array['Leader', 'Character', 'Event', 'Stage', 'Don'], c.category), c.cost nulls last, mdc.card_id;
$$;

revoke all on function public.owned_card_totals(text) from public;
revoke all on function public.meta_deck_progress(text) from public;
revoke all on function public.meta_pickups(text, integer) from public;
grant execute on function public.owned_card_totals(text) to anon, authenticated;
grant execute on function public.meta_deck_progress(text) to anon, authenticated;
grant execute on function public.meta_pickups(text, integer) to anon, authenticated;
revoke all on function public.meta_deck_check(uuid, text) from public;
grant execute on function public.meta_deck_check(uuid, text) to anon, authenticated;
