-- Languages are browsed separately: summaries and playsets per language.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into public.sets (id, language, source_id, code, name, kind, sort_order) values
  ('en-569101', 'en', '569101', 'OP-01', 'ROMANCE DAWN', 'booster', 569101),
  ('ja-550101', 'ja', '550101', 'OP-01', 'ROMANCE DAWN', 'booster', 550101);
insert into public.cards (id, name_en, name_ja, category, colors, cost, types) values
  ('OP01-025', 'Roronoa Zoro', 'ロロノア・ゾロ', 'Character', '{Red}', 3, '{}');
insert into public.printings (id, card_id, language, code, variant, variant_index, set_id, rarity, name, image_url) values
  ('en:OP01-025', 'OP01-025', 'en', 'OP01-025', 'base', 0, 'en-569101', 'SuperRare', 'Roronoa Zoro', 'x'),
  ('ja:OP01-025', 'OP01-025', 'ja', 'OP01-025', 'base', 0, 'ja-550101', 'SuperRare', 'ロロノア・ゾロ', 'x');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'alice@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select public.set_collection_quantity('en:OP01-025', 2);
select public.set_collection_quantity('ja:OP01-025', 2);

select results_eq(
  $$select total_quantity::int, unique_printings::int from public.collection_summary(p_language => 'en')$$,
  $$values (2, 1)$$,
  'the summary counts one language');
select results_eq(
  $$select total_quantity::int from public.collection_summary()$$,
  $$values (4)$$,
  'without a language the summary counts everything');
select is(
  (select count(*)::int from public.search_collection(p_languages => array['en'], p_playset => 'full')), 0,
  'two English + two Japanese copies are not an English playset');
select results_eq(
  $$select card_quantity::int from public.search_collection(p_languages => array['ja'])$$,
  $$values (2)$$,
  'card totals count the browsed language only');

select * from finish();
rollback;
