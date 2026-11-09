-- Search filters players expect: card type (trait), attribute, counter, power, has Trigger, keyword
-- labels and words in the effect text — for the Cards search and the collection alike. Plus the list
-- of card types, for the type picker.

drop function if exists public.search_cards(text, text[], text, text[], text[], text[], integer, integer, text, integer, integer);
drop function if exists public.search_collection(text, text[], text[], text[], text[], text[], integer, integer, text, text, text, integer, integer);

create function public.search_cards(
  p_query      text    default null,
  p_languages  text[]  default null,   -- only cards printed in these languages; null = all
  p_set_id     text    default null,   -- only cards with a printing in this set
  p_colors     text[]  default null,   -- card has ANY of these colors
  p_categories text[]  default null,
  p_rarities   text[]  default null,   -- card has a printing (in p_languages) with one of these rarities
  p_cost_min   integer default null,
  p_cost_max   integer default null,
  p_types      text[]  default null,   -- card types (traits), any of them
  p_attributes text[]  default null,   -- Slash, Strike, Ranged, Special, Wisdom; any of them
  p_counters   integer[] default null, -- printed counter values; 0 = no counter
  p_power_min  integer default null,
  p_power_max  integer default null,
  p_has_trigger boolean default null,
  p_keywords   text[]  default null,   -- every one of these labels, e.g. {Blocker,On Play}
  p_effect     text    default null,   -- every word appears in the effect or trigger text
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
      and (p_types is null or m.types && p_types)
      and (p_attributes is null or m.attributes && p_attributes)
      and (p_counters is null or coalesce(m.counter, 0) = any (p_counters))
      and (p_power_min is null or m.power >= p_power_min)
      and (p_power_max is null or m.power <= p_power_max)
      and (p_has_trigger is null or (m.trigger is not null) = p_has_trigger)
      and (p_keywords is null or not exists (
        select 1 from unnest(p_keywords) as kw
        where coalesce(m.effect, '') || ' ' || coalesce(m.trigger, '') not ilike '%[' || kw || ']%'
      ))
      and (p_effect is null or not exists (
        select 1 from unnest(string_to_array(lower(btrim(p_effect)), ' ')) as w
        where w <> '' and lower(coalesce(m.effect, '') || ' ' || coalesce(m.trigger, '')) not like '%' || w || '%'
      ))
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

grant execute on function public.search_cards(text, text[], text, text[], text[], text[], integer, integer, text[], text[], integer[], integer, integer, boolean, text[], text, text, integer, integer) to anon, authenticated;

create function public.search_collection(
  p_query      text    default null,
  p_languages  text[]  default null,
  p_set_codes  text[]  default null,   -- e.g. {OP-01,ST-10}; any language
  p_colors     text[]  default null,
  p_categories text[]  default null,
  p_rarities   text[]  default null,
  p_cost_min   integer default null,
  p_cost_max   integer default null,
  p_types      text[]  default null,   -- card types (traits), any of them
  p_attributes text[]  default null,   -- Slash, Strike, Ranged, Special, Wisdom; any of them
  p_counters   integer[] default null, -- printed counter values; 0 = no counter
  p_power_min  integer default null,
  p_power_max  integer default null,
  p_has_trigger boolean default null,
  p_keywords   text[]  default null,   -- every one of these labels, e.g. {Blocker,On Play}
  p_effect     text    default null,   -- every word appears in the effect or trigger text
  p_art        text    default null,   -- base | alt (alternate arts are 'parallel' printings)
  p_playset    text    default null,   -- full (4+) | incomplete (1-3) | extra (5+), per card in p_languages
  p_sort       text    default 'number',  -- number | name | cost | quantity | recent
  p_limit      integer default 60,
  p_offset     integer default 0
)
returns table (
  printing_id    text,
  card_id        text,
  code           text,
  language       text,
  variant        text,
  variant_index  integer,
  rarity         text,
  image_url      text,
  set_id         text,
  set_code       text,
  name           text,
  category       text,
  colors         text[],
  cost           integer,
  quantity       integer,
  card_quantity  bigint,
  total_count    bigint,
  total_quantity bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with tokens as (
    select coalesce(array_agg(t), '{}') as list
    from unnest(string_to_array(public.search_normalize(p_query), ' ')) as t
    where t <> ''
  ),
  -- Copies per card across every printing in the languages being browsed: the playset.
  card_totals as (
    select p.card_id, sum(c.quantity)::bigint as total
    from public.collection_items c
    join public.printings p on p.id = c.printing_id
    where c.user_id = auth.uid()
      and (p_languages is null or p.language = any (p_languages))
    group by p.card_id
  ),
  matches as (
    select
      c.printing_id, p.card_id, p.code, p.language, p.variant, p.variant_index, p.rarity, p.image_url,
      p.set_id, s.code as set_code, k.name, k.category, k.colors, k.cost, c.quantity, t.total as card_quantity,
      c.updated_at
    from public.collection_items c
    join public.printings p on p.id = c.printing_id
    join public.cards k on k.id = p.card_id
    join public.sets s on s.id = p.set_id
    join card_totals t on t.card_id = p.card_id
    where c.user_id = auth.uid()
      and (p_languages is null or p.language = any (p_languages))
      and (p_set_codes is null or s.code = any (p_set_codes))
      and (p_rarities is null or p.rarity = any (p_rarities))
      and (p_colors is null or k.colors && p_colors)
      and (p_categories is null or k.category = any (p_categories))
      and (p_cost_min is null or k.cost >= p_cost_min)
      and (p_cost_max is null or k.cost <= p_cost_max)
      and (p_types is null or k.types && p_types)
      and (p_attributes is null or k.attributes && p_attributes)
      and (p_counters is null or coalesce(k.counter, 0) = any (p_counters))
      and (p_power_min is null or k.power >= p_power_min)
      and (p_power_max is null or k.power <= p_power_max)
      and (p_has_trigger is null or (k.trigger is not null) = p_has_trigger)
      and (p_keywords is null or not exists (
        select 1 from unnest(p_keywords) as kw
        where coalesce(k.effect, '') || ' ' || coalesce(k.trigger, '') not ilike '%[' || kw || ']%'
      ))
      and (p_effect is null or not exists (
        select 1 from unnest(string_to_array(lower(btrim(p_effect)), ' ')) as w
        where w <> '' and lower(coalesce(k.effect, '') || ' ' || coalesce(k.trigger, '')) not like '%' || w || '%'
      ))
      and (p_art is null
        or (p_art = 'alt' and p.variant = 'parallel')
        or (p_art = 'base' and p.variant <> 'parallel'))
      and (p_playset is null
        or (p_playset = 'full' and t.total >= 4)
        or (p_playset = 'incomplete' and t.total < 4)
        or (p_playset = 'extra' and t.total > 4))
      and not exists (
        select 1 from unnest((select list from tokens)) as tk
        where k.search_text not like '%' || tk || '%'
      )
  ),
  ranked as (
    select m.*,
      count(*) over () as total_count,
      sum(m.quantity) over () as total_quantity,
      row_number() over (
        order by
          case when p_sort = 'name' then m.name end,
          case when p_sort = 'cost' then m.cost end nulls last,
          case when p_sort = 'quantity' then m.quantity end desc,
          case when p_sort = 'recent' then m.updated_at end desc,
          m.card_id, m.language, m.variant, m.variant_index
      ) as position
    from matches m
  )
  select r.printing_id, r.card_id, r.code, r.language, r.variant, r.variant_index, r.rarity, r.image_url,
         r.set_id, r.set_code, r.name, r.category, r.colors, r.cost, r.quantity, r.card_quantity,
         r.total_count, r.total_quantity
  from ranked r
  order by r.position
  limit least(greatest(coalesce(p_limit, 60), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke execute on function public.search_collection(text, text[], text[], text[], text[], text[], integer, integer, text[], text[], integer[], integer, integer, boolean, text[], text, text, text, text, integer, integer) from public, anon;
grant execute on function public.search_collection(text, text[], text[], text[], text[], text[], integer, integer, text[], text[], integer[], integer, integer, boolean, text[], text, text, text, text, integer, integer) to authenticated;

-- Every card type with how many cards have it, in one language's spelling (types are printed in the
-- card's language; Japanese-only cards carry Japanese types).
create function public.card_types(p_language text default 'en')
returns table (type text, cards bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select t, count(distinct c.id)
  from public.cards c
  cross join lateral unnest(c.types) as t
  where exists (select 1 from public.printings p where p.card_id = c.id and p.language = coalesce(p_language, p.language))
  group by t
  order by count(distinct c.id) desc, t;
$$;

grant execute on function public.card_types(text) to anon, authenticated;
