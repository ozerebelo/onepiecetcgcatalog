-- =============================================================================
-- Milestone 6: delete your own account, and send feedback from inside the app.
-- =============================================================================

-- Deletes the caller's account. Everything they own (profile, collection, activity log, wishlist,
-- decks) goes with it through the existing `on delete cascade` foreign keys. Feedback they sent is
-- kept, without their id. SECURITY DEFINER because users cannot touch auth.users themselves; it can
-- only ever remove the caller (auth.uid()).
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'You must be signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- Feedback: anyone can send a note (signed in or not); nobody can read notes through the API.
-- We read them in the database dashboard.
create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid default auth.uid() references auth.users (id) on delete set null,
  message    text not null check (char_length(btrim(message)) between 3 and 4000),
  -- Optional reply address for visitors without an account.
  contact    text check (char_length(contact) <= 200),
  -- Where in the app it was sent from, e.g. "/deck/…".
  page       text check (char_length(page) <= 300),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "Anyone can send feedback" on public.feedback
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

revoke all on public.feedback from anon, authenticated;
grant insert (message, contact, page) on public.feedback to anon, authenticated;
