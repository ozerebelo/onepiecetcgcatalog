-- Milestone 3: what a collection says about itself (stats, near-complete playsets, growth over time)
-- and a wishlist. Everything is per card language, like the rest of the app.

-- ---------------------------------------------------------------------------
-- Wishlist: printings a user wants (a chase alt art, or a deck's missing cards)
-- ---------------------------------------------------------------------------
create table public.wishlist_items (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  printing_id text not null references public.printings (id) on update cascade on delete cascade,
  quantity    integer not null default 1 check (quantity between 1 and 99),
  created_at  timestamptz not null default now(),
  primary key (user_id, printing_id)
);

create index wishlist_items_printing_id_idx on public.wishlist_items (printing_id);

alter table public.wishlist_items enable row level security;

create policy "Users read their own wishlist" on public.wishlist_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add to their own wishlist" on public.wishlist_items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users change their own wishlist" on public.wishlist_items
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users remove from their own wishlist" on public.wishlist_items
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.wishlist_items from anon, authenticated;
grant select, insert, delete on public.wishlist_items to authenticated;
grant update (quantity) on public.wishlist_items to authenticated;

-- The wishlist with what each entry is and how many you own (of the printing, and of the card).
create function public.wishlist(p_language text default null)
returns table (
  printing_id   text,
  card_id       text,
  code          text,
  language      text,
  variant       text,
  variant_index integer,
  rarity        text,
  name          text,
  image_url     text,
  set_code      text,
  wanted        integer,
  owned         integer,
  owned_card    integer,
  created_at    timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select w.printing_id, p.card_id, p.code, p.language, p.variant, p.variant_index, p.rarity, p.name, p.image_url,
         s.code, w.quantity,
         coalesce((select c.quantity from public.collection_items c
                   where c.user_id = w.user_id and c.printing_id = w.printing_id), 0),
         coalesce((select sum(c.quantity)::int from public.collection_items c
                   join public.printings p2 on p2.id = c.printing_id
                   where c.user_id = w.user_id and p2.card_id = p.card_id and p2.language = p.language), 0),
         w.created_at
  from public.wishlist_items w
  join public.printings p on p.id = w.printing_id
  join public.sets s on s.id = p.set_id
  where w.user_id = auth.uid()
    and (p_language is null or p.language = p_language)
  order by w.created_at desc, p.code;
$$;

-- Put a deck's missing cards on the wishlist: for each card short of what the deck plays (copies in
-- p_language, any art), want its base printing in that language. Returns how many cards were added.
create function public.wishlist_add_missing(p_deck_id uuid, p_language text default 'en')
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  added integer;
begin
  perform public.require_user();
  with missing as (
    select dc.card_id, dc.quantity - coalesce((
             select sum(c.quantity) from public.collection_items c
             join public.printings p on p.id = c.printing_id
             where c.user_id = auth.uid() and p.card_id = dc.card_id and p.language = p_language), 0) as short
    from public.deck_cards dc
    join public.decks d on d.id = dc.deck_id
    where dc.deck_id = p_deck_id and d.user_id = auth.uid()
  ),
  base as (
    select m.card_id, m.short, (
             select p.id from public.printings p
             where p.card_id = m.card_id and p.language = p_language
             order by (p.variant <> 'base'), (p.variant = 'parallel'), p.variant_index, p.code
             limit 1) as printing_id
    from missing m
    where m.short > 0
  ),
  upserted as (
    insert into public.wishlist_items (user_id, printing_id, quantity)
    select auth.uid(), b.printing_id, least(b.short, 99) from base b where b.printing_id is not null
    on conflict (user_id, printing_id) do update
      set quantity = greatest(public.wishlist_items.quantity, excluded.quantity)
    returning 1
  )
  select count(*) into added from upserted;
  return added;
end;
$$;

-- ---------------------------------------------------------------------------
-- Insights
-- ---------------------------------------------------------------------------

-- Cards one to three copies short of a playset (leaders excluded: a deck plays one), closest first,
-- with an image of a printing you own.
create function public.near_playsets(p_language text default 'en', p_limit integer default 12)
returns table (card_id text, name text, category text, colors text[], cost integer, owned integer, image_url text)
language sql
stable
security invoker
set search_path = ''
as $$
  with totals as (
    select p.card_id, sum(c.quantity)::int as owned
    from public.collection_items c
    join public.printings p on p.id = c.printing_id
    where c.user_id = auth.uid() and p.language = p_language
    group by p.card_id
    having sum(c.quantity) between 1 and 3
  )
  select t.card_id, k.name, k.category, k.colors, k.cost, t.owned, rep.image_url
  from totals t
  join public.cards k on k.id = t.card_id and k.category <> 'Leader'
  cross join lateral (
    select p.image_url
    from public.collection_items c
    join public.printings p on p.id = c.printing_id
    where c.user_id = auth.uid() and p.card_id = t.card_id and p.language = p_language
    order by c.quantity desc, (p.variant <> 'base')
    limit 1
  ) rep
  order by t.owned desc, t.card_id
  limit least(greatest(coalesce(p_limit, 12), 1), 100);
$$;

-- One call for the Stats view: totals, playsets, spares, colours, types, rarity completion.
create function public.collection_stats(p_language text default 'en')
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with mine as (
    select c.quantity, p.id as printing_id, p.card_id, p.rarity, k.category, k.colors
    from public.collection_items c
    join public.printings p on p.id = c.printing_id
    join public.cards k on k.id = p.card_id
    where c.user_id = auth.uid() and p.language = p_language
  ),
  per_card as (
    select card_id, min(category) as category, sum(quantity)::int as copies from mine group by card_id
  )
  select jsonb_build_object(
    'copies', coalesce((select sum(quantity) from mine), 0),
    'printings', (select count(*) from mine),
    'cards', (select count(*) from per_card),
    'leaders', (select count(*) from per_card where category = 'Leader'),
    'playsets', (select count(*) from per_card where category <> 'Leader' and copies >= 4),
    'spares', coalesce((select sum(greatest(copies - 4, 0)) from per_card where category <> 'Leader'), 0),
    'since', (select min(e.created_at) from public.collection_events e where e.user_id = auth.uid()),
    'by_color', coalesce((
      select jsonb_agg(jsonb_build_object('color', color, 'copies', copies, 'cards', cards) order by copies desc)
      from (select col as color, sum(quantity) as copies, count(distinct card_id) as cards
            from mine cross join lateral unnest(colors) as col group by col) x), '[]'::jsonb),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category', category, 'copies', copies, 'cards', cards) order by copies desc)
      from (select category, sum(quantity) as copies, count(distinct card_id) as cards from mine group by category) x),
      '[]'::jsonb),
    'by_rarity', coalesce((
      select jsonb_agg(jsonb_build_object('rarity', r.rarity, 'owned', coalesce(o.owned, 0), 'total', r.total) order by r.rarity)
      from (select p.rarity, count(*) as total from public.printings p where p.language = p_language group by p.rarity) r
      left join (select rarity, count(*) as owned from mine group by rarity) o on o.rarity = r.rarity), '[]'::jsonb)
  );
$$;

-- Copies added and removed per day (from the activity log), for growth over time.
create function public.collection_growth(p_language text default 'en', p_days integer default 90)
returns table (day date, added integer, removed integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select (e.created_at at time zone 'utc')::date,
         coalesce(sum(e.delta) filter (where e.delta > 0), 0)::int,
         coalesce(-sum(e.delta) filter (where e.delta < 0), 0)::int
  from public.collection_events e
  join public.printings p on p.id = e.printing_id
  where e.user_id = auth.uid()
    and p.language = p_language
    and e.created_at >= now() - make_interval(days => least(greatest(coalesce(p_days, 90), 1), 730))
  group by 1
  order by 1;
$$;

revoke execute on function
  public.wishlist(text),
  public.wishlist_add_missing(uuid, text),
  public.near_playsets(text, integer),
  public.collection_stats(text),
  public.collection_growth(text, integer)
from public, anon;

grant execute on function
  public.wishlist(text),
  public.wishlist_add_missing(uuid, text),
  public.near_playsets(text, integer),
  public.collection_stats(text),
  public.collection_growth(text, integer)
to authenticated;
