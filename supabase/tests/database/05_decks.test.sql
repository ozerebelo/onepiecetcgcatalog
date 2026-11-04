-- Decks: saving, checking against the collection, built-deck reservations, privacy.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- ---------------------------------------------------------------------------
-- Fixture
-- ---------------------------------------------------------------------------
insert into public.sets (id, language, source_id, code, name, kind, sort_order) values
  ('en-569101', 'en', '569101', 'OP-01', 'ROMANCE DAWN', 'booster', 569101),
  ('ja-550101', 'ja', '550101', 'OP-01', 'ROMANCE DAWN', 'booster', 550101);
insert into public.cards (id, name_en, category, colors, cost) values
  ('OP01-001', 'Roronoa Zoro', 'Leader', '{Red}', 5),
  ('OP01-016', 'Nami', 'Character', '{Red}', 1),
  ('OP01-025', 'Roronoa Zoro', 'Character', '{Red}', 3),
  ('OP01-086', 'Overheat', 'Event', '{Red}', 1);
insert into public.printings (id, card_id, language, code, variant, variant_index, set_id, rarity, name, image_url) values
  ('en:OP01-001',    'OP01-001', 'en', 'OP01-001',    'base',     0, 'en-569101', 'Leader',   'Roronoa Zoro', 'img/en/001'),
  ('en:OP01-016',    'OP01-016', 'en', 'OP01-016',    'base',     0, 'en-569101', 'Rare',     'Nami', 'img/en/016'),
  ('en:OP01-016_p1', 'OP01-016', 'en', 'OP01-016_p1', 'parallel', 1, 'en-569101', 'Rare',     'Nami', 'img/en/016p1'),
  ('ja:OP01-016',    'OP01-016', 'ja', 'OP01-016',    'base',     0, 'ja-550101', 'Rare',     'ナミ', 'img/ja/016'),
  ('en:OP01-025',    'OP01-025', 'en', 'OP01-025',    'base',     0, 'en-569101', 'SuperRare','Roronoa Zoro', 'img/en/025'),
  ('en:OP01-086',    'OP01-086', 'en', 'OP01-086',    'base',     0, 'en-569101', 'Uncommon', 'Overheat', 'img/en/086');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com');
-- Alice owns 4 Nami (2 EN base, 1 EN alt art, 1 JP), 1 Zoro character, 1 Zoro leader.
insert into public.collection_items (user_id, printing_id, quantity) values
  ('00000000-0000-0000-0000-0000000000a1', 'en:OP01-016', 2),
  ('00000000-0000-0000-0000-0000000000a1', 'en:OP01-016_p1', 1),
  ('00000000-0000-0000-0000-0000000000a1', 'ja:OP01-016', 1),
  ('00000000-0000-0000-0000-0000000000a1', 'en:OP01-025', 1),
  ('00000000-0000-0000-0000-0000000000a1', 'en:OP01-001', 1);

-- ---------------------------------------------------------------------------
-- Saving (as Alice)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select results_eq(
  $$select (r->>'card_count')::int, r->'skipped'->>0
    from (select public.save_deck(null, '  Zoro  ', '[
      {"card_id": "OP01-001", "quantity": 1},
      {"card_id": "op01-016", "quantity": 4},
      {"card_id": "OP01-025", "quantity": 2},
      {"card_id": "OP01-025", "quantity": 2},
      {"card_id": "OP01-086", "quantity": 2},
      {"card_id": "XX99-001", "quantity": 1}]'::jsonb) as r) x$$,
  $$values (11, 'XX99-001')$$,
  'save_deck sums duplicates, normalizes case and skips unknown cards');
select results_eq(
  $$select name, leader_card_id, card_count from public.decks$$,
  $$values ('Zoro'::text, 'OP01-001'::text, 11)$$,
  'deck name trimmed, leader detected, card count stored');

-- ---------------------------------------------------------------------------
-- Checking
-- ---------------------------------------------------------------------------
select results_eq(
  $$select card_id, needed, owned, have, missing
    from public.check_deck((select id from public.decks where name = 'Zoro'))$$,
  $$values ('OP01-001'::text, 1, 1, 1, 0), ('OP01-016'::text, 4, 4, 4, 0),
           ('OP01-025'::text, 4, 1, 1, 3), ('OP01-086'::text, 2, 0, 0, 2)$$,
  'any printing in any language fills a slot; leader first, then characters by cost, then events');
select results_eq(
  $$select owned, have, missing from public.check_deck((select id from public.decks where name = 'Zoro'), array['en'])
    where card_id = 'OP01-016'$$,
  $$values (3, 3, 1)$$,
  'English-only ignores Japanese copies');
select is(
  (select jsonb_array_length(owned_printings) from public.check_deck((select id from public.decks where name = 'Zoro'))
    where card_id = 'OP01-016'),
  3, 'owned printings are listed');
select is(
  (select image_url from public.check_deck((select id from public.decks where name = 'Zoro'), array['en'])
    where card_id = 'OP01-016'),
  'img/en/016', 'image prefers the base art in the first language');
select results_eq(
  $$select card_id, known, needed from public.check_cards('[{"card_id": "XX99-001", "quantity": 2}, {"card_id": " op01-016 ", "quantity": 1}]')$$,
  $$values ('OP01-016'::text, true, 1), ('XX99-001'::text, false, 2)$$,
  'check_cards works on unsaved lists and flags unknown numbers last');

-- Built decks hold their cards back.
select ok((public.save_deck(null, 'Nami deck', '[{"card_id": "OP01-016", "quantity": 3}]')->>'card_count')::int = 3, 'second deck saved');
update public.decks set is_built = true where name = 'Nami deck';
select results_eq(
  $$select owned, reserved, have, missing from public.check_deck((select id from public.decks where name = 'Zoro'), null, true)
    where card_id = 'OP01-016'$$,
  $$values (4, 3, 1, 3)$$,
  'copies used by a built deck are reserved when asked');
select results_eq(
  $$select reserved, have from public.check_deck((select id from public.decks where name = 'Zoro'), null, false)
    where card_id = 'OP01-016'$$,
  $$values (0, 4)$$,
  'no reservation unless asked');
select results_eq(
  $$select reserved, have from public.check_deck((select id from public.decks where name = 'Nami deck'), null, true)
    where card_id = 'OP01-016'$$,
  $$values (0, 3)$$,
  'a built deck does not reserve cards against itself');

select set_eq(
  $$select name, card_count, owned_count, leader_name, is_built from public.deck_summaries()$$,
  $$values ('Zoro'::text, 11, 6, 'Roronoa Zoro'::text, false), ('Nami deck'::text, 3, 3, null::text, true)$$,
  'deck summaries count owned cards per deck');

-- Updating replaces the list.
select results_eq(
  $$select (public.save_deck((select id from public.decks where name = 'Zoro'), 'Zoro v2',
      '[{"card_id": "OP01-001", "quantity": 1}, {"card_id": "OP01-016", "quantity": 1}]')->>'card_count')::int$$,
  $$values (2)$$,
  'saving an existing deck replaces its cards');
select is((select count(*)::int from public.deck_cards dc join public.decks d on d.id = dc.deck_id where d.name = 'Zoro v2'), 2,
  'old cards are gone');
select throws_ok(
  $$update public.decks set user_id = '00000000-0000-0000-0000-0000000000b2' where name = 'Zoro v2'$$,
  '42501', null, 'decks cannot be handed to another user');

-- Remember the deck id for Bob's attempts (custom setting, readable in any role).
reset role;
select ok(set_config('test.zoro', (select id::text from public.decks where name = 'Zoro v2'), true) is not null, 'remember Alice''s deck id');

-- ---------------------------------------------------------------------------
-- Privacy (as Bob)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
select is((select count(*)::int from public.decks), 0, 'Bob cannot see Alice''s decks');
select is((select count(*)::int from public.deck_cards), 0, 'Bob cannot see Alice''s deck lists');
select is((select count(*)::int from public.check_deck(current_setting('test.zoro')::uuid)), 0, 'Bob cannot check Alice''s deck');
select throws_ok(
  $$select public.save_deck(current_setting('test.zoro')::uuid, 'hacked', '[]')$$,
  'P0002', null, 'Bob cannot overwrite Alice''s deck');
select throws_ok(
  $$insert into public.deck_cards (deck_id, card_id, quantity) values (current_setting('test.zoro')::uuid, 'OP01-016', 1)$$,
  '42501', null, 'Bob cannot add cards to Alice''s deck');
select is((select count(*)::int from public.deck_summaries()), 0, 'Bob''s deck list is empty');

-- Alice can delete; cards go with the deck.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
delete from public.decks where name = 'Nami deck';
select is((select count(*)::int from public.decks), 1, 'deleting a deck works');
select is((select count(*)::int from public.deck_cards), 2, 'its cards are deleted with it');
reset role;

set local role anon;
select throws_ok($$select * from public.decks$$, '42501', null, 'anonymous visitors cannot read decks');
select throws_ok($$select * from public.check_cards('[]')$$, '42501', null, 'anonymous visitors cannot check lists');
reset role;

select * from finish();
rollback;
