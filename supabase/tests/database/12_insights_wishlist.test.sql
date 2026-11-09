-- Milestone 3: wishlist (private, deck missing cards), near playsets, stats, growth.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into public.sets (id, language, source_id, code, name, kind, sort_order) values
  ('en-569101', 'en', '569101', 'OP-01', 'ROMANCE DAWN', 'booster', 569101);
insert into public.cards (id, name_en, category, colors, cost, types) values
  ('OP01-001', 'Roronoa Zoro', 'Leader', '{Red}', 5, '{}'),
  ('OP01-016', 'Nami', 'Character', '{Red}', 1, '{}'),
  ('OP01-025', 'Roronoa Zoro', 'Character', '{Red}', 3, '{}'),
  ('OP01-047', 'Trafalgar Law', 'Character', '{Green,Red}', 5, '{}');
insert into public.printings (id, card_id, language, code, variant, variant_index, set_id, rarity, name, image_url) values
  ('en:OP01-001',    'OP01-001', 'en', 'OP01-001',    'base',     0, 'en-569101', 'Leader',    'Roronoa Zoro', 'x'),
  ('en:OP01-016',    'OP01-016', 'en', 'OP01-016',    'base',     0, 'en-569101', 'Rare',      'Nami', 'x'),
  ('en:OP01-025',    'OP01-025', 'en', 'OP01-025',    'base',     0, 'en-569101', 'SuperRare', 'Roronoa Zoro', 'x'),
  ('en:OP01-025_p1', 'OP01-025', 'en', 'OP01-025_p1', 'parallel', 1, 'en-569101', 'SuperRare', 'Roronoa Zoro', 'x'),
  ('en:OP01-047',    'OP01-047', 'en', 'OP01-047',    'base',     0, 'en-569101', 'SuperRare', 'Trafalgar Law', 'x');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
-- Alice: leader ×1, Nami ×3, Zoro 2 base + 3 alt art (5), Law ×1.
select public.set_collection_quantity('en:OP01-001', 1);
select public.set_collection_quantity('en:OP01-016', 3);
select public.set_collection_quantity('en:OP01-025', 2);
select public.set_collection_quantity('en:OP01-025_p1', 3);
select public.set_collection_quantity('en:OP01-047', 1);

select results_eq(
  $$select card_id, owned from public.near_playsets('en')$$,
  $$values ('OP01-016'::text, 3), ('OP01-047'::text, 1)$$,
  'near playsets: 1–3 copies, closest first, no leaders, no full playsets');

select results_eq(
  $$select (s->>'copies')::int, (s->>'printings')::int, (s->>'cards')::int, (s->>'leaders')::int,
           (s->>'playsets')::int, (s->>'spares')::int
    from public.collection_stats('en') s$$,
  $$values (10, 5, 4, 1, 1, 1)$$,
  'stats: copies, printings, cards, leaders, full playsets, spares beyond four');
select is(
  (select (c->>'copies')::int from public.collection_stats('en') s, jsonb_array_elements(s->'by_color') c where c->>'color' = 'Green'),
  1, 'stats by colour count multicolour cards in each colour');
select is(
  (select (r->>'owned')::int || '/' || (r->>'total') from public.collection_stats('en') s, jsonb_array_elements(s->'by_rarity') r
   where r->>'rarity' = 'SuperRare'),
  '3/3', 'stats by rarity: owned printings of all printings');

select results_eq(
  $$select sum(added)::int, sum(removed)::int from public.collection_growth('en')$$,
  $$values (10, 0)$$, 'growth sums the activity log');

-- Wishlist
insert into public.wishlist_items (printing_id) values ('en:OP01-025_p1');
select results_eq(
  $$select printing_id, wanted, owned, owned_card from public.wishlist('en')$$,
  $$values ('en:OP01-025_p1'::text, 1, 3, 5)$$,
  'wishlist with owned copies of the printing and the card');

insert into public.decks (id, name) values ('00000000-0000-0000-0000-00000000d001', 'Red');
insert into public.deck_cards (deck_id, card_id, quantity) values
  ('00000000-0000-0000-0000-00000000d001', 'OP01-001', 1),
  ('00000000-0000-0000-0000-00000000d001', 'OP01-016', 4),
  ('00000000-0000-0000-0000-00000000d001', 'OP01-025', 4),
  ('00000000-0000-0000-0000-00000000d001', 'OP01-047', 4);
select is(public.wishlist_add_missing('00000000-0000-0000-0000-00000000d001', 'en'), 2,
  'adding a deck''s missing cards: Nami and Law are short (Zoro and the leader are covered)');
select set_eq(
  $$select printing_id, wanted from public.wishlist('en')$$,
  $$values ('en:OP01-025_p1'::text, 1), ('en:OP01-016'::text, 1), ('en:OP01-047'::text, 3)$$,
  'each missing card wants its base printing, as many as are missing');
select is(public.wishlist_add_missing('00000000-0000-0000-0000-00000000d001', 'en'), 2,
  'adding again keeps one entry per printing');
select is((select count(*)::int from public.wishlist_items), 3, 'no duplicates');

-- Privacy
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
select is((select count(*)::int from public.wishlist_items), 0, 'other users can''t read your wishlist');
select is(public.wishlist_add_missing('00000000-0000-0000-0000-00000000d001', 'en'), 0,
  'or fill it from your decks');
select is((select (s->>'copies')::int from public.collection_stats('en') s), 0, 'stats are per user');

select * from finish();
rollback;
