-- =============================================================================
-- Phase 3: decks and deck checking.
--
-- Decks reference CARDS (e.g. OP01-016), not printings: any art, reprint or
-- language of a card fills a deck slot. Checking a deck compares each slot with
-- the user's collection, summed over all printings of that card.
--
-- "Built" decks are decks the user has physically sleeved up. Optionally, cards
-- used by built decks are held back when checking another deck, because those
-- copies aren't free to use.
--
-- All functions are SECURITY INVOKER: RLS keeps users inside their own decks.
-- =============================================================================

create table public.decks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null check (char_length(btrim(name)) between 1 and 80),
  leader_card_id text references public.cards (id) on update cascade on delete set null,
  notes          text check (char_length(notes) <= 2000),
  is_built       boolean not null default false,
  card_count     integer not null default 0 check (card_count >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.deck_cards (
  deck_id  uuid not null references public.decks (id) on delete cascade,
  card_id  text not null references public.cards (id) on update cascade on delete restrict,
  quantity integer not null check (quantity between 1 and 50),
  primary key (deck_id, card_id)
);

create index decks_user_updated_idx on public.decks (user_id, updated_at desc);
create index deck_cards_card_id_idx on public.deck_cards (card_id);

create trigger decks_updated_at before update on public.decks
  for each row execute function public.set_updated_at();

alter table public.decks enable row level security;
alter table public.deck_cards enable row level security;

create policy "Users read their own decks" on public.decks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create their own decks" on public.decks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own decks" on public.decks
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete their own decks" on public.decks
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read cards of their own decks" on public.deck_cards
  for select to authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = (select auth.uid())));
create policy "Users add cards to their own decks" on public.deck_cards
  for insert to authenticated
  with check (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = (select auth.uid())));
create policy "Users change cards of their own decks" on public.deck_cards
  for update to authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = (select auth.uid())))
  with check (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = (select auth.uid())));
create policy "Users remove cards from their own decks" on public.deck_cards
  for delete to authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id and d.user_id = (select auth.uid())));

revoke all on public.decks, public.deck_cards from anon, authenticated;
grant select, insert, delete on public.decks, public.deck_cards to authenticated;
-- leader_card_id / card_count are maintained by save_deck (which runs as the user); a user
-- could only ever mislabel their own deck.
grant update (name, notes, is_built, leader_card_id, card_count) on public.decks to authenticated;
grant update (quantity) on public.deck_cards to authenticated;

-- -----------------------------------------------------------------------------
-- Checking a list against the collection
-- -----------------------------------------------------------------------------

-- p_items:         [{"card_id": "OP01-016", "quantity": 4}, ...] (duplicates are summed)
-- p_languages:     which printings count as owned (null = English and Japanese)
-- p_reserve_built: hold back copies used by the user's *built* decks
-- p_exclude_deck:  the deck being checked, so it doesn't reserve its own cards
--
-- One row per card: needed / owned / reserved / have / missing, plus the owned
-- printings. Unknown card numbers come back with known = false.
create or replace function public.check_cards(
  p_items         jsonb,
  p_languages     text[]  default null,
  p_reserve_built boolean default false,
  p_exclude_deck  uuid    default null
)
returns table (
  card_id         text,
  known           boolean,
  name            text,
  category        text,
  colors          text[],
  cost            integer,
  image_url       text,
  needed          integer,
  owned           integer,
  reserved        integer,
  have            integer,
  missing         integer,
  owned_printings jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select public.require_user() as uid
  ),
  items as (
    select upper(btrim(x.card_id)) as card_id, least(sum(x.quantity), 50)::integer as needed
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(card_id text, quantity integer)
    where x.card_id is not null and x.quantity > 0
    group by 1
  ),
  owned as (
    select p.card_id,
           sum(ci.quantity)::integer as owned,
           jsonb_agg(jsonb_build_object(
             'printing_id', p.id, 'code', p.code, 'language', p.language, 'quantity', ci.quantity
           ) order by p.language, p.variant, p.variant_index) as printings
    from public.collection_items ci
    join public.printings p on p.id = ci.printing_id
    where ci.user_id = (select uid from params)
      and p.language = any (coalesce(p_languages, array['en', 'ja']))
      and p.card_id in (select card_id from items)
    group by p.card_id
  ),
  reserved as (
    select dc.card_id, sum(dc.quantity)::integer as reserved
    from public.deck_cards dc
    join public.decks d on d.id = dc.deck_id
    where p_reserve_built
      and d.user_id = (select uid from params)
      and d.is_built
      and d.id is distinct from p_exclude_deck
      and dc.card_id in (select card_id from items)
    group by dc.card_id
  ),
  rows as (
    select i.card_id,
           c.id is not null as known,
           c.name, c.category, c.colors, c.cost,
           i.needed,
           coalesce(o.owned, 0) as owned,
           coalesce(r.reserved, 0) as reserved,
           least(i.needed, greatest(coalesce(o.owned, 0) - coalesce(r.reserved, 0), 0)) as have,
           coalesce(o.printings, '[]'::jsonb) as owned_printings
    from items i
    left join public.cards c on c.id = i.card_id
    left join owned o on o.card_id = i.card_id
    left join reserved r on r.card_id = i.card_id
  )
  select r.card_id, r.known, r.name, r.category, r.colors, r.cost,
         (select p.image_url from public.printings p
           where p.card_id = r.card_id and p.language = any (coalesce(p_languages, array['en', 'ja']))
           order by array_position(coalesce(p_languages, array['en', 'ja']), p.language), (p.variant <> 'base'), p.variant_index
           limit 1) as image_url,
         r.needed, r.owned, r.reserved, r.have, r.needed - r.have as missing, r.owned_printings
  from rows r
  order by
    r.known desc,
    array_position(array['Leader', 'Character', 'Event', 'Stage', 'Don'], r.category),
    r.cost nulls last,
    r.card_id;
$$;

-- Checks a saved deck (its own cards are never reserved against itself).
create or replace function public.check_deck(
  p_deck_id       uuid,
  p_languages     text[]  default null,
  p_reserve_built boolean default false
)
returns table (
  card_id         text,
  known           boolean,
  name            text,
  category        text,
  colors          text[],
  cost            integer,
  image_url       text,
  needed          integer,
  owned           integer,
  reserved        integer,
  have            integer,
  missing         integer,
  owned_printings jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from public.check_cards(
    (select coalesce(jsonb_agg(jsonb_build_object('card_id', dc.card_id, 'quantity', dc.quantity)), '[]'::jsonb)
       from public.deck_cards dc where dc.deck_id = p_deck_id),
    p_languages,
    p_reserve_built,
    p_deck_id
  );
$$;

-- -----------------------------------------------------------------------------
-- Saving and listing decks
-- -----------------------------------------------------------------------------

-- Creates (p_deck_id null) or replaces a deck's name, notes and full card list in
-- one transaction. Unknown card numbers are skipped and reported. The leader is
-- the first Leader card in the list. Returns {"id", "card_count", "skipped"}.
create or replace function public.save_deck(
  p_deck_id uuid,
  p_name    text,
  p_items   jsonb,
  p_notes   text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  v_id uuid := p_deck_id;
  v_skipped text[];
  v_count integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Items must be a JSON array' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.decks (user_id, name, notes) values (uid, btrim(p_name), nullif(btrim(p_notes), ''))
      returning id into v_id;
  else
    update public.decks set name = btrim(p_name), notes = nullif(btrim(p_notes), '')
      where id = v_id and user_id = uid;
    if not found then
      raise exception 'Deck not found' using errcode = 'P0002';
    end if;
    delete from public.deck_cards where deck_id = v_id;
  end if;

  with items as (
    select upper(btrim(x.card_id)) as card_id, least(sum(x.quantity), 50)::integer as quantity
    from jsonb_to_recordset(p_items) as x(card_id text, quantity integer)
    where x.card_id is not null and x.quantity > 0
    group by 1
  ),
  inserted as (
    insert into public.deck_cards (deck_id, card_id, quantity)
    select v_id, i.card_id, i.quantity from items i
    where exists (select 1 from public.cards c where c.id = i.card_id)
    returning card_id, quantity
  )
  select
    (select coalesce(sum(quantity), 0) from inserted),
    (select coalesce(array_agg(i.card_id order by i.card_id), '{}') from items i
      where not exists (select 1 from public.cards c where c.id = i.card_id))
  into v_count, v_skipped;

  update public.decks d
    set card_count = v_count,
        leader_card_id = (
          select dc.card_id from public.deck_cards dc
          join public.cards c on c.id = dc.card_id
          where dc.deck_id = v_id and c.category = 'Leader'
          order by dc.card_id limit 1)
    where d.id = v_id;

  return jsonb_build_object('id', v_id, 'card_count', v_count, 'skipped', to_jsonb(v_skipped));
end;
$$;

-- The Decks screen: each deck with its leader and how many of its cards the user owns.
create or replace function public.deck_summaries(p_languages text[] default null)
returns table (
  id               uuid,
  name             text,
  leader_card_id   text,
  leader_name      text,
  leader_colors    text[],
  leader_image_url text,
  is_built         boolean,
  card_count       integer,
  owned_count      integer,
  updated_at       timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with owned as (
    select p.card_id, sum(ci.quantity)::integer as owned
    from public.collection_items ci
    join public.printings p on p.id = ci.printing_id
    where ci.user_id = auth.uid() and p.language = any (coalesce(p_languages, array['en', 'ja']))
    group by p.card_id
  )
  select d.id, d.name, d.leader_card_id, c.name, c.colors,
         (select p.image_url from public.printings p
           where p.card_id = d.leader_card_id and p.language = any (coalesce(p_languages, array['en', 'ja']))
           order by array_position(coalesce(p_languages, array['en', 'ja']), p.language), (p.variant <> 'base'), p.variant_index
           limit 1),
         d.is_built, d.card_count,
         coalesce((select sum(least(dc.quantity, coalesce(o.owned, 0)))::integer
                     from public.deck_cards dc left join owned o on o.card_id = dc.card_id
                    where dc.deck_id = d.id), 0),
         d.updated_at
  from public.decks d
  left join public.cards c on c.id = d.leader_card_id
  where d.user_id = auth.uid()
  order by d.updated_at desc;
$$;

revoke execute on function
  public.check_cards(jsonb, text[], boolean, uuid),
  public.check_deck(uuid, text[], boolean),
  public.save_deck(uuid, text, jsonb, text),
  public.deck_summaries(text[])
from public, anon;

grant execute on function
  public.check_cards(jsonb, text[], boolean, uuid),
  public.check_deck(uuid, text[], boolean),
  public.save_deck(uuid, text, jsonb, text),
  public.deck_summaries(text[])
to authenticated;
