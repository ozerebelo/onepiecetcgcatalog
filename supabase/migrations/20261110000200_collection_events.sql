-- Activity log: every change to a collection, recorded by the database itself, so taps, quick adds,
-- imports and pack openings are all covered without the app having to remember. It powers "recently
-- added", undo history and growth over time. Users can read their own events; nobody writes them
-- directly.

create table public.collection_events (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users (id) on delete cascade,
  printing_id    text not null references public.printings (id) on update cascade on delete cascade,
  delta          integer not null check (delta <> 0),
  quantity_after integer not null check (quantity_after >= 0),
  created_at     timestamptz not null default now()
);

create index collection_events_user_idx on public.collection_events (user_id, id desc);

alter table public.collection_events enable row level security;

create policy "Users read their own collection history" on public.collection_events
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.collection_events from anon, authenticated;
grant select on public.collection_events to authenticated;

create function public.log_collection_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid      uuid := coalesce(new.user_id, old.user_id);
  pid      text := coalesce(new.printing_id, old.printing_id);
  q_before integer := case when tg_op = 'INSERT' then 0 else old.quantity end;
  q_after  integer := case when tg_op = 'DELETE' then 0 else new.quantity end;
begin
  if q_after = q_before then
    return null;
  end if;
  -- An account being deleted takes its collection with it; nothing to record (and nothing to point at).
  if not exists (select 1 from auth.users u where u.id = uid) then
    return null;
  end if;
  insert into public.collection_events (user_id, printing_id, delta, quantity_after)
  values (uid, pid, q_after - q_before, q_after);
  return null;
end;
$$;

revoke execute on function public.log_collection_change() from public, anon, authenticated;

create trigger collection_items_log
  after insert or update of quantity or delete on public.collection_items
  for each row execute function public.log_collection_change();

-- Recent activity with what each change was, newest first. Page with p_before (the last id seen).
create function public.collection_activity(
  p_language text    default null,
  p_limit    integer default 50,
  p_before   bigint  default null
)
returns table (
  id             bigint,
  printing_id    text,
  card_id        text,
  code           text,
  language       text,
  variant        text,
  variant_index  integer,
  rarity         text,
  name           text,
  image_url      text,
  set_code       text,
  delta          integer,
  quantity_after integer,
  created_at     timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.id, e.printing_id, p.card_id, p.code, p.language, p.variant, p.variant_index, p.rarity, p.name,
         p.image_url, s.code, e.delta, e.quantity_after, e.created_at
  from public.collection_events e
  join public.printings p on p.id = e.printing_id
  join public.sets s on s.id = p.set_id
  where e.user_id = auth.uid()
    and (p_language is null or p.language = p_language)
    and (p_before is null or e.id < p_before)
  order by e.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

revoke execute on function public.collection_activity(text, integer, bigint) from public, anon;
grant execute on function public.collection_activity(text, integer, bigint) to authenticated;
