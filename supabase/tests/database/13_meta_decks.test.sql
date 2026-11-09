-- Milestone 5: meta decks (public, read-only), progress per deck, best next pickups.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into public.sets (id, language, source_id, code, name, kind, sort_order) values
  ('en-569101', 'en', '569101', 'OP-01', 'ROMANCE DAWN', 'booster', 569101),
  ('ja-569101', 'ja', '569101', 'OP-01', 'ROMANCE DAWN', 'booster', 569101);
insert into public.cards (id, name_en, category, colors, cost, types) values
  ('OP01-001', 'Roronoa Zoro', 'Leader', '{Red}', 5, '{}'),
  ('OP01-016', 'Nami', 'Character', '{Red}', 1, '{}'),
  ('OP01-025', 'Roronoa Zoro', 'Character', '{Red}', 3, '{}'),
  ('OP01-047', 'Trafalgar Law', 'Character', '{Green,Red}', 5, '{}');
insert into public.printings (id, card_id, language, code, variant, variant_index, set_id, rarity, name, image_url) values
  ('en:OP01-001',    'OP01-001', 'en', 'OP01-001',    'base',     0, 'en-569101', 'Leader',    'Roronoa Zoro', 'en-leader'),
  ('en:OP01-016',    'OP01-016', 'en', 'OP01-016',    'base',     0, 'en-569101', 'Rare',      'Nami', 'x'),
  ('en:OP01-025',    'OP01-025', 'en', 'OP01-025',    'base',     0, 'en-569101', 'SuperRare', 'Roronoa Zoro', 'x'),
  ('en:OP01-025_p1', 'OP01-025', 'en', 'OP01-025_p1', 'parallel', 1, 'en-569101', 'SuperRare', 'Roronoa Zoro', 'x'),
  ('en:OP01-047',    'OP01-047', 'en', 'OP01-047',    'base',     0, 'en-569101', 'SuperRare', 'Trafalgar Law', 'x'),
  ('ja:OP01-047',    'OP01-047', 'ja', 'OP01-047',    'base',     0, 'ja-569101', 'SuperRare', 'Trafalgar Law', 'x');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com');

-- Two reference lists (the importer writes these as the database owner).
insert into public.meta_decks (id, slug, archetype, leader_card_id, format, event, event_date, placement, players, source_name, source_url, card_count) values
  ('00000000-0000-0000-0000-00000000d001', 'a-zoro-win', 'Red Zoro', 'OP01-001', 'OP17', 'Regional A', '2026-11-01', 1, 512, 'Example', 'https://example.com/a', 13),
  ('00000000-0000-0000-0000-00000000d002', 'b-zoro-law', 'Red Zoro Law', 'OP01-001', 'OP17', 'Regional B', '2026-11-08', 2, 256, 'Example', 'https://example.com/b', 9);
insert into public.meta_deck_cards (meta_deck_id, card_id, quantity) values
  ('00000000-0000-0000-0000-00000000d001', 'OP01-001', 1),
  ('00000000-0000-0000-0000-00000000d001', 'OP01-016', 4),
  ('00000000-0000-0000-0000-00000000d001', 'OP01-025', 4),
  ('00000000-0000-0000-0000-00000000d001', 'OP01-047', 4),
  ('00000000-0000-0000-0000-00000000d002', 'OP01-001', 1),
  ('00000000-0000-0000-0000-00000000d002', 'OP01-025', 4),
  ('00000000-0000-0000-0000-00000000d002', 'OP01-047', 4);

-- Signed out: the lists are public, nothing is owned, nothing can be written.
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is((select count(*)::integer from public.meta_decks), 2, 'anyone can read meta decks');
select results_eq(
  $$ select slug, needed, have, missing from public.meta_deck_progress('en') $$,
  $$ values ('b-zoro-law'::text, 9, 0, 9), ('a-zoro-win'::text, 13, 0, 13) $$,
  'signed out, every card is missing (newest event first)');
select throws_ok(
  $$ insert into public.meta_decks (slug, archetype, leader_card_id, format, event, event_date, source_name, source_url)
     values ('x', 'x', 'OP01-001', 'OP17', 'x', '2026-01-01', 'x', 'https://x') $$,
  '42501', null, 'visitors cannot add meta decks');

-- Alice: leader ×1, Nami ×3, Zoro 2 base + 2 alt art (a playset), Law ×4 in Japanese only.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select public.set_collection_quantity('en:OP01-001', 1);
select public.set_collection_quantity('en:OP01-016', 3);
select public.set_collection_quantity('en:OP01-025', 2);
select public.set_collection_quantity('en:OP01-025_p1', 2);
select public.set_collection_quantity('ja:OP01-047', 4);

select results_eq(
  $$ select slug, have, missing from public.meta_deck_progress('en') $$,
  $$ values ('b-zoro-law'::text, 5, 4), ('a-zoro-win'::text, 8, 5) $$,
  'English: alt arts count, Japanese copies do not');
select results_eq(
  $$ select slug, have, missing from public.meta_deck_progress('ja') $$,
  $$ values ('b-zoro-law'::text, 4, 5), ('a-zoro-win'::text, 4, 9) $$,
  'Japanese: only the Japanese Law counts');
select is((select leader_image from public.meta_deck_progress('en') limit 1), 'en-leader', 'leader art in the chosen language');
select results_eq(
  $$ select card_id, needed, have, missing from public.meta_deck_check('00000000-0000-0000-0000-00000000d001', 'en') $$,
  $$ values ('OP01-001'::text, 1, 1, 0), ('OP01-016'::text, 4, 3, 1), ('OP01-025'::text, 4, 4, 0), ('OP01-047'::text, 4, 0, 4) $$,
  'one meta deck card by card: leader first, then by cost');
select throws_ok(
  $$ delete from public.meta_decks $$, '42501', null, 'users cannot delete meta decks');
select throws_ok(
  $$ update public.meta_deck_cards set quantity = 1 $$, '42501', null, 'users cannot change meta lists');

-- Pickups (English): Law is missing ×4 in both decks; Nami ×1 only in the first.
select results_eq(
  $$ select card_id, copies, decks, decks_finished, owned from public.meta_pickups('en') $$,
  $$ values ('OP01-047'::text, 4, 2, 1, 0), ('OP01-016'::text, 1, 1, 0, 3) $$,
  'Law is in both decks and finishes the second; Nami is one short');
select is((select count(*)::integer from public.meta_pickups('en', 1)), 1, 'the limit is respected');
-- In Japanese she owns the Laws, so the leader and both Zoro and Nami are the gaps.
select ok(
  not exists (select 1 from public.meta_pickups('ja') where card_id = 'OP01-047'),
  'owned Japanese copies are not suggested in Japanese');

-- Bob owns nothing: everything is missing; Alice's collection never leaks.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
select is((select sum(have)::integer from public.meta_deck_progress('en')), 0, 'progress is per user');
select is((select count(*)::integer from public.owned_card_totals('en')), 0, 'owned totals only show your own cards');
reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(
  (select sum(needed)::integer from public.meta_deck_check('00000000-0000-0000-0000-00000000d002', 'en')), 9,
  'signed out, a meta deck can still be read card by card');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
select is(
  (select decks from public.meta_pickups('en') where card_id = 'OP01-025'), 2,
  'for Bob, Zoro is a pickup for both decks');

select * from finish();
rollback;
