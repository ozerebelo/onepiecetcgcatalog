-- =============================================================================
-- Meta by leader: every card that appears in a meta list, with what the leader
-- pages need to draw it (name, category, cost, colours, art in the chosen
-- language) and how many copies the caller owns in that language (0 signed out).
-- The leader ranking, core cards and consensus lists are computed in the app
-- from the public meta_decks / meta_deck_cards rows (packages/core meta-stats).
-- =============================================================================

create or replace function public.meta_card_info(p_language text default 'en')
returns table (
  card_id   text,
  name      text,
  category  text,
  colors    text[],
  cost      integer,
  image_url text,
  owned     integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with cards_in_meta as (select distinct mdc.card_id from public.meta_deck_cards mdc),
  owned as (select * from public.owned_card_totals(p_language))
  select c.id, c.name, c.category, c.colors, c.cost,
         (select p.image_url from public.printings p
           where p.card_id = c.id
           order by (p.language <> p_language), (p.variant <> 'base'), p.variant_index
           limit 1),
         coalesce(o.owned, 0)
  from cards_in_meta m
  join public.cards c on c.id = m.card_id
  left join owned o on o.card_id = m.card_id;
$$;

revoke all on function public.meta_card_info(text) from public;
grant execute on function public.meta_card_info(text) to anon, authenticated;
