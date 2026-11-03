-- Collections: privacy between users, quantity edits, bulk import modes, reads.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

-- ---------------------------------------------------------------------------
-- Fixture
-- ---------------------------------------------------------------------------
insert into public.sets (id, language, source_id, code, name, kind, sort_order) values
  ('en-569101', 'en', '569101', 'OP-01', 'ROMANCE DAWN', 'booster', 569101),
  ('ja-550101', 'ja', '550101', 'OP-01', 'ROMANCE DAWN', 'booster', 550101);
insert into public.cards (id, name_en, name_ja, category, colors, cost, types) values
  ('OP01-001', 'Roronoa Zoro', 'ロロノア・ゾロ', 'Leader', '{Red}', 5, '{"Straw Hat Crew"}'),
  ('OP01-016', 'Nami', 'ナミ', 'Character', '{Red}', 1, '{"Straw Hat Crew"}');
insert into public.printings (id, card_id, language, code, variant, variant_index, set_id, rarity, name, image_url) values
  ('en:OP01-001',    'OP01-001', 'en', 'OP01-001',    'base',     0, 'en-569101', 'Leader', 'Roronoa Zoro', 'x'),
  ('en:OP01-001_p1', 'OP01-001', 'en', 'OP01-001_p1', 'parallel', 1, 'en-569101', 'Leader', 'Roronoa Zoro', 'x'),
  ('ja:OP01-001',    'OP01-001', 'ja', 'OP01-001',    'base',     0, 'ja-550101', 'Leader', 'ロロノア・ゾロ', 'x'),
  ('en:OP01-016',    'OP01-016', 'en', 'OP01-016',    'base',     0, 'en-569101', 'Rare',   'Nami', 'x');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com');

-- ---------------------------------------------------------------------------
-- Single-card edits (as Alice)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select is(public.adjust_collection_quantity('en:OP01-001', 1), 1, '+1 adds a new card');
select is(public.adjust_collection_quantity('en:OP01-001', 2), 3, '+2 increments');
select is(public.adjust_collection_quantity('en:OP01-001', -1), 2, '-1 decrements');
select is(public.adjust_collection_quantity('en:OP01-001_p1', 1), 1, 'alt art tracked separately');
select is(public.adjust_collection_quantity('en:OP01-001_p1', -5), 0, 'going below zero removes the card');
select is((select count(*)::int from public.collection_items where printing_id = 'en:OP01-001_p1'), 0, 'removed row is deleted');
select is(public.adjust_collection_quantity('en:OP01-016', -1), 0, 'decrementing an unowned card is a no-op');
select is(public.adjust_collection_quantity('en:OP01-016', 20000), 9999, 'quantities are capped at 9999');
select is(public.set_collection_quantity('en:OP01-016', 4), 4, 'set quantity');
select is(public.set_collection_quantity('ja:OP01-001', 3), 3, 'set quantity on a Japanese printing');
select is(public.set_collection_quantity('ja:OP01-001', 0), 0, 'set quantity 0 removes');
select is((select count(*)::int from public.collection_items), 2, 'Alice owns two printings');
select throws_ok($$select public.adjust_collection_quantity('en:XX99-001', 1)$$, '23503', null, 'unknown printings are rejected');

-- ---------------------------------------------------------------------------
-- Privacy (as Bob)
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
select is((select count(*)::int from public.collection_items), 0, 'Bob cannot see Alice''s collection');
select is(public.adjust_collection_quantity('en:OP01-001', 5), 5, 'Bob has his own copy count');
update public.collection_items set quantity = 99 where user_id = '00000000-0000-0000-0000-0000000000a1';
select throws_ok(
  $$insert into public.collection_items (user_id, printing_id, quantity) values ('00000000-0000-0000-0000-0000000000a1', 'en:OP01-016', 1)$$,
  '42501', null, 'Bob cannot add cards to Alice''s collection');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select is((select quantity from public.collection_items where printing_id = 'en:OP01-001'), 2, 'Bob''s update did not touch Alice''s rows');
reset role;

set local role anon;
select throws_ok($$select * from public.collection_items$$, '42501', null, 'anonymous visitors cannot read collections');
select throws_ok($$select public.adjust_collection_quantity('en:OP01-001', 1)$$, '42501', null, 'anonymous visitors cannot edit collections');
reset role;

-- ---------------------------------------------------------------------------
-- Bulk import (as Alice; she owns en:OP01-001 x2, en:OP01-016 x4)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select results_eq(
  $$select r->>'matched', r->>'inserted', r->>'updated', r->>'unknown_count', r->'unknown'->>0, r->>'total_quantity'
    from (select public.import_collection('[
      {"printing_id": "en:OP01-001", "quantity": 1},
      {"printing_id": "en:OP01-001", "quantity": 1},
      {"printing_id": "ja:OP01-001", "quantity": 2},
      {"printing_id": "en:NOPE-001", "quantity": 1}]'::jsonb, 'add', true) as r) x$$,
  $$values ('2', '1', '1', '1', 'en:NOPE-001', '10')$$,
  'dry run reports the exact outcome (duplicates summed, unknown codes listed)');
select is((select sum(quantity)::int from public.collection_items), 6, 'dry run wrote nothing');

select results_eq(
  $$select r->>'inserted', r->>'updated', r->>'total_quantity'
    from (select public.import_collection('[
      {"printing_id": "en:OP01-001", "quantity": 1},
      {"printing_id": "en:OP01-001", "quantity": 1},
      {"printing_id": "ja:OP01-001", "quantity": 2},
      {"printing_id": "en:NOPE-001", "quantity": 1}]'::jsonb, 'add') as r) x$$,
  $$values ('1', '1', '10')$$,
  'add mode adds to existing quantities');
select is((select quantity from public.collection_items where printing_id = 'en:OP01-001'), 4, 'add mode: 2 + 1 + 1 = 4');

select results_eq(
  $$select r->>'removed', r->>'updated', r->>'unchanged', r->>'inserted', r->>'total_quantity'
    from (select public.import_collection('[
      {"printing_id": "en:OP01-016", "quantity": 1},
      {"printing_id": "ja:OP01-001", "quantity": 0},
      {"printing_id": "en:OP01-001", "quantity": 4}]'::jsonb, 'set') as r) x$$,
  $$values ('1', '1', '1', '0', '5')$$,
  'set mode sets exact quantities and removes zeroes');

select results_eq(
  $$select r->>'removed', r->>'inserted', r->>'unique_printings'
    from (select public.import_collection('[{"printing_id": "en:OP01-001_p1", "quantity": 2}]'::jsonb, 'replace_all') as r) x$$,
  $$values ('2', '1', '1')$$,
  'replace_all makes the list the whole collection');

select throws_ok($$select public.import_collection('[]'::jsonb, 'merge')$$, '22023', null, 'unknown import modes are rejected');

-- Bob's copy survived Alice's replace_all.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
select is((select total_quantity::int from public.collection_summary()), 5, 'other users are unaffected by replace_all');

-- ---------------------------------------------------------------------------
-- Reads (Alice: en:OP01-001_p1 x2, en:OP01-001 x3, ja:OP01-001 x1)
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select is(public.set_collection_quantity('en:OP01-001', 3), 3, 'setup: en:OP01-001 x3');
select is(public.set_collection_quantity('ja:OP01-001', 1), 1, 'setup: ja:OP01-001 x1');

select set_eq(
  $$select printing_id, quantity from public.collection_quantities(p_set_id => 'en-569101')$$,
  $$values ('en:OP01-001'::text, 3), ('en:OP01-001_p1'::text, 2)$$,
  'quantities for one set');
select is((select count(*)::int from public.collection_quantities(p_card_id => 'OP01-001')), 3, 'quantities for one card, all printings');
select results_eq(
  $$select total_quantity::int, unique_printings::int, unique_cards::int from public.collection_summary()$$,
  $$values (6, 3, 1)$$,
  'summary counts copies, printings and distinct cards');
select set_eq(
  $$select set_id, owned_printings::int from public.collection_set_progress()$$,
  $$values ('en-569101'::text, 2), ('ja-550101'::text, 1)$$,
  'per-set progress');
select results_eq(
  $$select printing_id, quantity, total_count::int, total_quantity::int
    from public.search_collection(p_query => 'zoro', p_languages => array['en'], p_sort => 'quantity')$$,
  $$values ('en:OP01-001'::text, 3, 2, 5), ('en:OP01-001_p1'::text, 2, 2, 5)$$,
  'collection search filters by text and language, sorts by quantity');
select is((select count(*)::int from public.search_collection(p_query => 'nami')), 0, 'collection search only returns owned cards');
select results_eq(
  $$select jsonb_array_length(e), e->0->>'printing_id', e->0->>'set_code', (e->0->>'quantity')::int
    from (select public.export_collection() as e) x$$,
  $$values (3, 'en:OP01-001', 'OP-01', 3)$$,
  'export returns the whole collection with set info');

select * from finish();
rollback;
