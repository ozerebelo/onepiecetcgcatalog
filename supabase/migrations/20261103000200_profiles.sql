-- =============================================================================
-- User profiles: one row per auth user, created automatically on sign-up.
-- Collections and decks (later phases) hang off auth.users / profiles.
-- =============================================================================

create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  username            text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name        text check (char_length(display_name) between 1 and 50),
  -- Which card languages the user cares about; drives default filters.
  card_languages      text[] not null default array['en', 'ja']
                      check (cardinality(card_languages) > 0 and card_languages <@ array['en', 'ja']),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "Users can read their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy "Users can update their own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- id and timestamps are not client-editable.
grant update (username, display_name, card_languages) on public.profiles to authenticated;

-- Create the profile row when a user signs up. Runs as the table owner so it can
-- insert despite RLS; search_path is pinned to avoid hijacking.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text := nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '');
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(requested_name, 50))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
