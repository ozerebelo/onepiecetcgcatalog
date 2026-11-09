-- Meta by leader: card details + what you own, for every card in a meta list.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into public.sets (id, language, source_id, code, name, kind, sort_order) values
  ('en-569101', 'en', '569101', 'OP-01', 'ROMANCE DAWN', 'booster', 569101);
insert into public.cards (id, name_en, category, colors, cost, types) values
  ('OP01-001', 'Roronoa Zoro', 'Leader', '{Red}', 5, '{}'),
  ('OP01-016', 'Nami', 'Character', '{Red}', 1, '{}'),
  ('OP01-025', 'Roronoa Zoro', 'Character', '{Red}', 3, '{}');
insert into public.printings (id, card_id, language, code, variant, variant_index, set_id, rarity, name, image_url) values
  ('en:OP01-001', 'OP01-001', 'en', 'OP01-001', 'base', 0, 'en-569101', 'Leader', 'Roronoa Zoro', 'leader-art'),
  ('en:OP01-016', 'OP01-016', 'en', 'OP01-016', 'base', 0, 'en-569101', 'Rare', 'Nami', 'nami-art'),
  ('en:OP01-025', 'OP01-025', 'en', 'OP01-025', 'base', 0, 'en-569101', 'SuperRare', 'Roronoa Zoro', 'zoro-art');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'alice@example.com');
insert into public.meta_decks (id, slug, archetype, leader_card_id, format, event, event_date, source_name, source_url) values
  ('00000000-0000-0000-0000-00000000d001', 'a', 'Red Zoro', 'OP01-001', 'OP17', 'Regional A', '2026-11-01', 'Example', 'https://example.com/a');
insert into public.meta_deck_cards (meta_deck_id, card_id, quantity) values
  ('00000000-0000-0000-0000-00000000d001', 'OP01-001', 1),
  ('00000000-0000-0000-0000-00000000d001', 'OP01-016', 4);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select results_eq(
  $$ select card_id, owned, image_url from public.meta_card_info('en') order by card_id $$,
  $$ values ('OP01-001'::text, 0, 'leader-art'::text), ('OP01-016'::text, 0, 'nami-art'::text) $$,
  'signed out: only cards in meta lists, nothing owned');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select public.set_collection_quantity('en:OP01-016', 3);
select is((select owned from public.meta_card_info('en') where card_id = 'OP01-016'), 3, 'counts your copies');
select is((select owned from public.meta_card_info('ja') where card_id = 'OP01-016'), 0, 'in one language only');
select ok(not exists (select 1 from public.meta_card_info('en') where card_id = 'OP01-025'), 'cards outside meta lists are left out');

select * from finish();
rollback;
