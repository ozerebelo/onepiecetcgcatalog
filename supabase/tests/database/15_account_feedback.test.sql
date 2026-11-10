-- Milestone 6: delete_account removes only the caller; feedback is insert-only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into public.sets (id, language, source_id, code, name, kind, sort_order) values
  ('en-569101', 'en', '569101', 'OP-01', 'ROMANCE DAWN', 'booster', 569101);
insert into public.cards (id, name_en, category, colors, cost, types) values
  ('OP01-016', 'Nami', 'Character', '{Red}', 1, '{}');
insert into public.printings (id, card_id, language, code, variant, variant_index, set_id, rarity, name, image_url) values
  ('en:OP01-016', 'OP01-016', 'en', 'OP01-016', 'base', 0, 'en-569101', 'Rare', 'Nami', 'x');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com');

-- Visitors: can send feedback, cannot read it, cannot delete accounts.
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select lives_ok(
  $$ insert into public.feedback (message, contact, page) values ('Love the deck check', 'me@example.com', '/decks') $$,
  'a visitor can send feedback');
select throws_ok($$ select * from public.feedback $$, '42501', null, 'feedback cannot be read through the API');
select throws_ok($$ insert into public.feedback (message) values ('x') $$, '23514', null, 'feedback needs a real message');
select throws_ok($$ select public.delete_account() $$, '42501', null, 'visitors cannot call delete_account');

-- Alice and Bob each own something and send feedback.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select public.set_collection_quantity('en:OP01-016', 2);
select public.save_deck(null, 'Alice deck', '[{"card_id": "OP01-016", "quantity": 4}]'::jsonb, null);
select lives_ok($$ insert into public.feedback (message) values ('Alice was here') $$, 'a user can send feedback');
select throws_ok(
  $$ insert into public.feedback (message, user_id) values ('spoof', '00000000-0000-0000-0000-0000000000b2') $$,
  '42501', null, 'feedback cannot be sent as someone else');
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
select public.set_collection_quantity('en:OP01-016', 1);

-- Alice deletes her account.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select lives_ok($$ select public.delete_account() $$, 'a user can delete their own account');

reset role;
select is((select count(*)::integer from auth.users where email = 'alice@example.com'), 0, 'the account is gone');
select is(
  (select count(*)::integer from public.collection_items where user_id = '00000000-0000-0000-0000-0000000000a1')
  + (select count(*)::integer from public.decks where user_id = '00000000-0000-0000-0000-0000000000a1')
  + (select count(*)::integer from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  0, 'with its collection, decks and profile');
select is((select count(*)::integer from public.collection_items where user_id = '00000000-0000-0000-0000-0000000000b2'), 1, 'other accounts are untouched');
select is(
  (select count(*)::integer from public.feedback where message = 'Alice was here' and user_id is null), 1,
  'feedback stays, without the deleted user');

select * from finish();
rollback;
