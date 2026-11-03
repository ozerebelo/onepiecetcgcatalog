-- =============================================================================
-- Phase 2: personal collections.
--
-- A collection row = how many copies of one PRINTING a user owns (alt arts and
-- languages are tracked separately). Rows with quantity 0 are deleted, so the
-- table only holds what people actually own.
--
-- All functions are SECURITY INVOKER: they run as the calling user, so the RLS
-- policies below are what keeps users inside their own collection.
-- =============================================================================

create table public.collection_items (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  printing_id text not null references public.printings (id) on update cascade on delete restrict,
  quantity    integer not null check (quantity between 1 and 9999),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, printing_id)
);

create index collection_items_printing_id_idx on public.collection_items (printing_id);
create index collection_items_user_updated_idx on public.collection_items (user_id, updated_at desc);

create trigger collection_items_updated_at before update on public.collection_items
  for each row execute function public.set_updated_at();

alter table public.collection_items enable row level security;

create policy "Users read their own collection" on public.collection_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add to their own collection" on public.collection_items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own collection" on public.collection_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users remove from their own collection" on public.collection_items
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.collection_items from anon, authenticated;
grant select, insert, delete on public.collection_items to authenticated;
grant update (quantity) on public.collection_items to authenticated;

-- Shared guard: every collection function needs a signed-in user.
create or replace function public.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'You must be signed in' using errcode = '42501';
  end if;
  return uid;
end;
$$;

-- -----------------------------------------------------------------------------
-- Single-card edits
-- -----------------------------------------------------------------------------

-- Atomically adds `p_delta` (may be negative) to the owned quantity and returns
-- the new quantity (0 = removed). Safe under rapid repeated taps.
create or replace function public.adjust_collection_quantity(p_printing_id text, p_delta integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  new_quantity integer;
begin
  if p_delta is null or p_delta = 0 then
    select quantity into new_quantity from public.collection_items
      where user_id = uid and printing_id = p_printing_id;
    return coalesce(new_quantity, 0);
  end if;

  if p_delta > 0 then
    insert into public.collection_items (user_id, printing_id, quantity)
    values (uid, p_printing_id, least(p_delta, 9999))
    on conflict (user_id, printing_id)
      do update set quantity = least(public.collection_items.quantity + p_delta, 9999)
    returning quantity into new_quantity;
    return new_quantity;
  end if;

  update public.collection_items
    set quantity = quantity + p_delta
    where user_id = uid and printing_id = p_printing_id and quantity + p_delta > 0
    returning quantity into new_quantity;
  if found then
    return new_quantity;
  end if;

  delete from public.collection_items where user_id = uid and printing_id = p_printing_id;
  return 0;
end;
$$;

-- Sets the owned quantity outright (0 removes the card). Returns the new quantity.
create or replace function public.set_collection_quantity(p_printing_id text, p_quantity integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
begin
  if coalesce(p_quantity, 0) <= 0 then
    delete from public.collection_items where user_id = uid and printing_id = p_printing_id;
    return 0;
  end if;
  insert into public.collection_items (user_id, printing_id, quantity)
  values (uid, p_printing_id, least(p_quantity, 9999))
  on conflict (user_id, printing_id) do update set quantity = excluded.quantity;
  return least(p_quantity, 9999);
end;
$$;

-- -----------------------------------------------------------------------------
-- Bulk import
-- -----------------------------------------------------------------------------

-- Imports many rows in one transaction.
--
-- p_items: [{"printing_id": "en:OP01-016", "quantity": 4}, ...] (duplicates are summed)
-- p_mode:
--   'add'         add the quantities to what the user already owns
--   'set'         set each listed printing to exactly that quantity (0 removes it)
--   'replace_all' the list becomes the whole collection (unlisted printings are removed)
-- p_dry_run: compute the exact outcome but write nothing (used for the preview).
--
-- Unknown printing ids are skipped and reported. Returns a jsonb summary.
create or replace function public.import_collection(
  p_items   jsonb,
  p_mode    text    default 'add',
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  v_ids text[];
  v_quantities integer[];
  v_unknown text[];
  v_inserted integer := 0;
  v_updated integer := 0;
  v_unchanged integer := 0;
  v_removed integer := 0;
  v_total bigint := 0;
  v_unique bigint := 0;
begin
  if p_mode is null or p_mode not in ('add', 'set', 'replace_all') then
    raise exception 'Unknown import mode "%"', p_mode using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Items must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 50000 then
    raise exception 'Too many rows (max 50000 per import)' using errcode = '22023';
  end if;

  -- Sum duplicates, split known printings from unknown ones.
  with input as (
    select x.printing_id, least(sum(x.quantity), 9999)::integer as quantity
    from jsonb_to_recordset(p_items) as x(printing_id text, quantity integer)
    where x.printing_id is not null and x.quantity is not null and x.quantity >= 0
    group by x.printing_id
  )
  select
    coalesce(array_agg(i.printing_id order by i.printing_id) filter (where p.id is not null), '{}'),
    coalesce(array_agg(i.quantity order by i.printing_id) filter (where p.id is not null), '{}'),
    coalesce(array_agg(i.printing_id order by i.printing_id) filter (where p.id is null), '{}')
  into v_ids, v_quantities, v_unknown
  from input i
  left join public.printings p on p.id = i.printing_id;

  -- Writes happen inside a sub-block so a dry run can roll them back while
  -- keeping the counts (PL/pgSQL variables survive the rollback).
  begin
    if p_mode = 'replace_all' then
      -- Everything not listed with a positive quantity goes.
      delete from public.collection_items c
        where c.user_id = uid
          and not exists (
            select 1 from unnest(v_ids, v_quantities) as i(printing_id, quantity)
            where i.printing_id = c.printing_id and i.quantity > 0);
      get diagnostics v_removed = row_count;
    elsif p_mode = 'set' then
      -- Listed with quantity 0 = remove.
      delete from public.collection_items c
        using unnest(v_ids, v_quantities) as i(printing_id, quantity)
        where c.user_id = uid and c.printing_id = i.printing_id and i.quantity = 0;
      get diagnostics v_removed = row_count;
    end if;

    with planned as (
      select i.printing_id,
             c.quantity as old_quantity,
             case when p_mode = 'add' then least(coalesce(c.quantity, 0) + i.quantity, 9999)
                  else i.quantity end as new_quantity
      from unnest(v_ids, v_quantities) as i(printing_id, quantity)
      left join public.collection_items c on c.user_id = uid and c.printing_id = i.printing_id
      where i.quantity > 0
    ),
    upserted as (
      insert into public.collection_items (user_id, printing_id, quantity)
      select uid, p.printing_id, p.new_quantity
      from planned p
      where p.old_quantity is distinct from p.new_quantity
      on conflict (user_id, printing_id) do update set quantity = excluded.quantity
      returning (xmax = 0) as inserted
    )
    select
      (select count(*) from upserted where inserted),
      (select count(*) from upserted where not inserted),
      (select count(*) from planned where old_quantity is not distinct from new_quantity)
    into v_inserted, v_updated, v_unchanged;

    select coalesce(sum(quantity), 0), count(*) into v_total, v_unique
      from public.collection_items where user_id = uid;

    if p_dry_run then
      raise exception 'binder_dry_run_rollback';
    end if;
  exception
    when raise_exception then
      if sqlerrm <> 'binder_dry_run_rollback' then
        raise;
      end if;
  end;

  return jsonb_build_object(
    'mode', p_mode,
    'dry_run', p_dry_run,
    'rows', jsonb_array_length(p_items),
    'matched', cardinality(v_ids),
    'inserted', v_inserted,
    'updated', v_updated,
    'unchanged', v_unchanged,
    'removed', v_removed,
    'unknown_count', cardinality(v_unknown),
    'unknown', to_jsonb(v_unknown[1:200]),
    'total_quantity', v_total,
    'unique_printings', v_unique
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Reads
-- -----------------------------------------------------------------------------

-- Owned quantities for the printings of one set and/or one card (for steppers and badges).
create or replace function public.collection_quantities(
  p_set_id  text default null,
  p_card_id text default null
)
returns table (printing_id text, quantity integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.printing_id, c.quantity
  from public.collection_items c
  join public.printings p on p.id = c.printing_id
  where c.user_id = auth.uid()
    and (p_set_id is null or p.set_id = p_set_id)
    and (p_card_id is null or p.card_id = p_card_id);
$$;

-- Headline numbers for the collection screen.
create or replace function public.collection_summary()
returns table (total_quantity bigint, unique_printings bigint, unique_cards bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(c.quantity), 0)::bigint, count(*)::bigint, count(distinct p.card_id)::bigint
  from public.collection_items c
  join public.printings p on p.id = c.printing_id
  where c.user_id = auth.uid();
$$;

-- How many printings of each set the user owns (set completion on the Sets screen).
create or replace function public.collection_set_progress(p_language text default null)
returns table (set_id text, owned_printings bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.set_id, count(*)::bigint
  from public.collection_items c
  join public.printings p on p.id = c.printing_id
  where c.user_id = auth.uid()
    and (p_language is null or p.language = p_language)
  group by p.set_id;
$$;

-- The collection screen: owned printings with card info, same filters as search_cards.
create or replace function public.search_collection(
  p_query      text    default null,
  p_languages  text[]  default null,
  p_set_id     text    default null,
  p_colors     text[]  default null,
  p_categories text[]  default null,
  p_rarities   text[]  default null,
  p_cost_min   integer default null,
  p_cost_max   integer default null,
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
  matches as (
    select
      c.printing_id, p.card_id, p.code, p.language, p.variant, p.variant_index, p.rarity, p.image_url,
      p.set_id, s.code as set_code, k.name, k.category, k.colors, k.cost, c.quantity, c.updated_at
    from public.collection_items c
    join public.printings p on p.id = c.printing_id
    join public.cards k on k.id = p.card_id
    join public.sets s on s.id = p.set_id
    where c.user_id = auth.uid()
      and (p_languages is null or p.language = any (p_languages))
      and (p_set_id is null or p.set_id = p_set_id)
      and (p_rarities is null or p.rarity = any (p_rarities))
      and (p_colors is null or k.colors && p_colors)
      and (p_categories is null or k.category = any (p_categories))
      and (p_cost_min is null or k.cost >= p_cost_min)
      and (p_cost_max is null or k.cost <= p_cost_max)
      and not exists (
        select 1 from unnest((select list from tokens)) as t
        where k.search_text not like '%' || t || '%'
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
         r.set_id, r.set_code, r.name, r.category, r.colors, r.cost, r.quantity, r.total_count, r.total_quantity
  from ranked r
  order by r.position
  limit least(greatest(coalesce(p_limit, 60), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Full collection as one JSON array (one response regardless of API row limits),
-- used for CSV / list export and backups.
create or replace function public.export_collection()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'printing_id', p.id,
      'card_id', p.card_id,
      'code', p.code,
      'language', p.language,
      'variant', p.variant,
      'rarity', p.rarity,
      'set_code', s.code,
      'set_name', s.name,
      'name', k.name,
      'quantity', c.quantity
    ) order by p.card_id, p.language, p.variant, p.variant_index), '[]'::jsonb)
  from public.collection_items c
  join public.printings p on p.id = c.printing_id
  join public.cards k on k.id = p.card_id
  join public.sets s on s.id = p.set_id
  where c.user_id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- Function privileges: signed-in users only.
-- -----------------------------------------------------------------------------

revoke execute on function
  public.require_user(),
  public.adjust_collection_quantity(text, integer),
  public.set_collection_quantity(text, integer),
  public.import_collection(jsonb, text, boolean),
  public.collection_quantities(text, text),
  public.collection_summary(),
  public.collection_set_progress(text),
  public.search_collection(text, text[], text, text[], text[], text[], integer, integer, text, integer, integer),
  public.export_collection()
from public, anon;

grant execute on function
  public.require_user(),
  public.adjust_collection_quantity(text, integer),
  public.set_collection_quantity(text, integer),
  public.import_collection(jsonb, text, boolean),
  public.collection_quantities(text, text),
  public.collection_summary(),
  public.collection_set_progress(text),
  public.search_collection(text, text[], text, text[], text[], text[], integer, integer, text, integer, integer),
  public.export_collection()
to authenticated;
