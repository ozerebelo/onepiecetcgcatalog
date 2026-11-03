-- Profiles are created on sign-up and are private to their owner.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@example.com', '{"display_name": "  Alice  "}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com', '{}');

select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'Alice', 'sign-up creates a profile with the trimmed display name');
select is(
  (select card_languages from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'),
  array['en', 'ja'], 'profiles default to both card languages');

set local role anon;
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon cannot read profiles');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select results_eq(
  $$select id from public.profiles$$,
  $$values ('00000000-0000-0000-0000-0000000000a1'::uuid)$$,
  'a user only sees their own profile');

select lives_ok(
  $$update public.profiles set username = 'alice', card_languages = array['en'] where id = '00000000-0000-0000-0000-0000000000a1'$$,
  'a user can update their own profile');

update public.profiles set display_name = 'Hacked' where id = '00000000-0000-0000-0000-0000000000b2';
reset role;
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'),
  null, 'a user cannot update someone else''s profile');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select throws_ok(
  $$update public.profiles set id = gen_random_uuid() where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'profile ids are not client-editable');
select throws_ok(
  $$update public.profiles set username = 'Not Valid!' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '23514', null, 'usernames are validated');

select * from finish();
rollback;
