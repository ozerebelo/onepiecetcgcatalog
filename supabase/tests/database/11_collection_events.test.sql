-- Activity log: every collection change is recorded, privately, and accounts can still be deleted.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into public.sets (id, language, source_id, code, name, kind, sort_order) values
  ('en-569101', 'en', '569101', 'OP-01', 'ROMANCE DAWN', 'booster', 569101),
  ('ja-550101', 'ja', '550101', 'OP-01', 'ROMANCE DAWN', 'booster', 550101);
insert into public.cards (id, name_en, name_ja, category, colors, cost, types) values
  ('OP01-016', 'Nami', 'ナミ', 'Character', '{Red}', 1, '{}');
insert into public.printings (id, card_id, language, code, variant, variant_index, set_id, rarity, name, image_url) values
  ('en:OP01-016', 'OP01-016', 'en', 'OP01-016', 'base', 0, 'en-569101', 'Rare', 'Nami', 'x'),
  ('ja:OP01-016', 'OP01-016', 'ja', 'OP01-016', 'base', 0, 'ja-550101', 'Rare', 'ナミ', 'x');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select public.adjust_collection_quantity('en:OP01-016', 1);
select public.set_collection_quantity('en:OP01-016', 3);
select public.adjust_collection_quantity('ja:OP01-016', 2);
select public.set_collection_quantity('en:OP01-016', 0);

select results_eq(
  $$select printing_id, delta, quantity_after from public.collection_activity() order by id$$,
  $$values ('en:OP01-016'::text, 1, 1), ('en:OP01-016'::text, 2, 3), ('ja:OP01-016'::text, 2, 2), ('en:OP01-016'::text, -3, 0)$$,
  'adds, sets and removals are all recorded with the change and the new count');
select results_eq(
  $$select delta from public.collection_activity(p_language => 'ja')$$,
  $$values (2)$$,
  'activity can be read per language');
select results_eq(
  $$select delta from public.collection_activity(p_limit => 1)$$,
  $$values (-3)$$,
  'newest first');
select is(
  (select count(*)::int from public.collection_activity(p_before => (select max(id) from public.collection_events))), 3,
  'paging with p_before');
select throws_ok(
  $$insert into public.collection_events (user_id, printing_id, delta, quantity_after)
    values ('00000000-0000-0000-0000-0000000000a1', 'en:OP01-016', 5, 5)$$,
  '42501', null, 'nobody writes events directly');
select is((select count(*)::int from public.collection_events where delta = 0), 0, 'no empty events');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
select is((select count(*)::int from public.collection_activity()), 0, 'other users see none of it');
select is((select count(*)::int from public.collection_events), 0, 'not even by reading the table');

reset role;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a1';
select is((select count(*)::int from public.collection_events), 0, 'deleting an account removes its history and still works');

select * from finish();
rollback;
