-- More ways to browse a collection: several sets at once (by set code, so OP-01 covers English and
-- Japanese), base vs alternate art, and playset status. The playset counts every printing of a card
-- in any language (2 base + 2 alt art is a full playset), the same rule the app shows everywhere.

drop function if exists public.search_collection(text, text[], text, text[], text[], text[], integer, integer, text, integer, integer);

create function public.search_collection(
  p_query      text    default null,
  p_languages  text[]  default null,
  p_set_codes  text[]  default null,   -- e.g. {OP-01,ST-10}; any language
  p_colors     text[]  default null,
  p_categories text[]  default null,
  p_rarities   text[]  default null,
  p_cost_min   integer default null,
  p_cost_max   integer default null,
  p_art        text    default null,   -- base | alt (alternate arts are 'parallel' printings)
  p_playset    text    default null,   -- full (4+) | incomplete (1-3) | extra (5+), counted per card
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
  -- Copies per card across every printing and language: the playset.
  card_totals as (
    select p.card_id, sum(c.quantity)::bigint as total
    from public.collection_items c
    join public.printings p on p.id = c.printing_id
    where c.user_id = auth.uid()
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

revoke execute on function
  public.search_collection(text, text[], text[], text[], text[], text[], integer, integer, text, text, text, integer, integer)
from public, anon;

grant execute on function
  public.search_collection(text, text[], text[], text[], text[], text[], integer, integer, text, text, text, integer, integer)
to authenticated;
