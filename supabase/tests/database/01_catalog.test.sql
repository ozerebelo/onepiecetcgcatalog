-- Catalog schema, access rules and search behaviour.
-- Run with `supabase test db` (Docker) or `pnpm db:test` (plain Postgres).
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- ---------------------------------------------------------------------------
-- Fixture
-- ---------------------------------------------------------------------------
insert into public.sets (id, language, source_id, code, name, kind, sort_order) values
  ('en-569101', 'en', '569101', 'OP-01', 'ROMANCE DAWN', 'booster', 569101),
  ('ja-550101', 'ja', '550101', 'OP-01', 'ROMANCE DAWN', 'booster', 550101),
  ('ja-550117', 'ja', '550117', 'OP-17', 'OP-17', 'booster', 550117);

insert into public.cards (id, name_en, name_ja, category, colors, cost, power, counter, types) values
  ('OP01-001', 'Roronoa Zoro', 'ロロノア・ゾロ', 'Leader', '{Red}', 5, 5000, null, '{Supernovas,"Straw Hat Crew"}'),
  ('OP01-025', 'Roronoa Zoro', 'ロロノア・ゾロ', 'Character', '{Red}', 3, 5000, null, '{Supernovas,"Straw Hat Crew"}'),
  ('OP01-060', 'Donquixote Doflamingo', 'ドンキホーテ・ドフラミンゴ', 'Leader', '{Blue,Purple}', 5, 5000, null, '{"The Seven Warlords of the Sea"}'),
  ('OP01-016', 'Nami', 'ナミ', 'Character', '{Red}', 1, 0, 2000, '{"Straw Hat Crew"}'),
  ('OP01-120', 'Shanks', 'シャンクス', 'Character', '{Red}', 10, 12000, null, '{"Four Emperors"}'),
  ('ST01-012', 'Monkey.D.Luffy', 'モンキー・D・ルフィ', 'Character', '{Red}', 5, 6000, null, '{Supernovas}'),
  ('OP17-001', null, 'テスト', 'Leader', '{Green}', 5, 5000, null, '{}');

insert into public.printings (id, card_id, language, code, variant, variant_index, set_id, rarity, name, image_url) values
  ('en:OP01-001',    'OP01-001', 'en', 'OP01-001',    'base',     0, 'en-569101', 'Leader',     'Roronoa Zoro', 'https://img/en/OP01-001.png'),
  ('en:OP01-001_p1', 'OP01-001', 'en', 'OP01-001_p1', 'parallel', 1, 'en-569101', 'Leader',     'Roronoa Zoro', 'https://img/en/OP01-001_p1.png'),
  ('ja:OP01-001',    'OP01-001', 'ja', 'OP01-001',    'base',     0, 'ja-550101', 'Leader',     'ロロノア・ゾロ', 'https://img/ja/OP01-001.png'),
  ('en:OP01-025',    'OP01-025', 'en', 'OP01-025',    'base',     0, 'en-569101', 'SuperRare',  'Roronoa Zoro', 'https://img/en/OP01-025.png'),
  ('en:OP01-060',    'OP01-060', 'en', 'OP01-060',    'base',     0, 'en-569101', 'Leader',     'Donquixote Doflamingo', 'https://img/en/OP01-060.png'),
  ('en:OP01-016',    'OP01-016', 'en', 'OP01-016',    'base',     0, 'en-569101', 'Rare',       'Nami', 'https://img/en/OP01-016.png'),
  ('en:OP01-120',    'OP01-120', 'en', 'OP01-120',    'base',     0, 'en-569101', 'SecretRare', 'Shanks', 'https://img/en/OP01-120.png'),
  ('en:ST01-012',    'ST01-012', 'en', 'ST01-012',    'base',     0, 'en-569101', 'SuperRare',  'Monkey.D.Luffy', 'https://img/en/ST01-012.png'),
  ('ja:OP17-001',    'OP17-001', 'ja', 'OP17-001',    'base',     0, 'ja-550117', 'Leader',     'テスト', 'https://img/ja/OP17-001.png');

-- ---------------------------------------------------------------------------
-- Structure & integrity
-- ---------------------------------------------------------------------------
select has_table('public', 'sets', 'sets table exists');
select has_table('public', 'cards', 'cards table exists');
select has_table('public', 'printings', 'printings table exists');
select is(
  (select bool_and(relrowsecurity) from pg_class
    where oid in ('public.sets'::regclass, 'public.cards'::regclass, 'public.printings'::regclass, 'public.ingest_runs'::regclass)),
  true, 'RLS enabled on every catalog table');
select is((select name from public.cards where id = 'OP17-001'), 'テスト', 'name falls back to Japanese when no English name');
select throws_ok(
  $$insert into public.printings (id, card_id, language, code, variant, variant_index, set_id, rarity, name, image_url)
    values ('en:OP01-016_p1', 'OP01-016', 'en', 'OP01-016_p1', 'parallel', 2, 'en-569101', 'Rare', 'Nami', 'x')$$,
  '23514', null, 'printing code, card id and variant columns must agree');
select throws_ok(
  $$insert into public.cards (id, name_en, category) values ('bad-id', 'x', 'Leader')$$,
  '23514', null, 'card ids are validated');

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
set local role anon;
select is((select count(*)::int from public.printings), 9, 'anon can read printings');
select throws_ok(
  $$insert into public.cards (id, name_en, category) values ('OP99-001', 'Hacker', 'Leader')$$,
  '42501', null, 'anon cannot insert cards');
select throws_ok($$delete from public.sets$$, '42501', null, 'anon cannot delete sets');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000aa", "role": "authenticated"}';
select throws_ok($$update public.cards set name_en = 'x'$$, '42501', null, 'signed-in users cannot modify cards');

-- ---------------------------------------------------------------------------
-- Search (as a signed-in user, through the same function the app calls)
-- ---------------------------------------------------------------------------
select results_eq(
  $$select id from public.search_cards(p_query => 'zoro')$$,
  $$values ('OP01-001'::text), ('OP01-025'::text)$$,
  'name search matches every card with that name');

select is(
  (select id from public.search_cards(p_query => 'op01-025') limit 1),
  'OP01-025', 'exact card number ranks first');

select results_eq(
  $$select id from public.search_cards(p_query => 'monkey d luffy')$$,
  $$values ('ST01-012'::text)$$,
  'punctuation-insensitive: "monkey d luffy" finds Monkey.D.Luffy');

select results_eq(
  $$select id from public.search_cards(p_query => 'ゾロ')$$,
  $$values ('OP01-001'::text), ('OP01-025'::text)$$,
  'Japanese names are searchable');

select results_eq(
  $$select id from public.search_cards(p_query => 'straw hat zoro')$$,
  $$values ('OP01-001'::text), ('OP01-025'::text)$$,
  'all tokens must match (type + name)');

select is(
  (select count(*)::int from public.search_cards(p_languages => array['en'])), 6,
  'language filter hides Japanese-only cards');

select is(
  (select image_url from public.search_cards(p_query => 'OP01-001', p_languages => array['ja', 'en'])),
  'https://img/ja/OP01-001.png', 'representative image follows the first preferred language');

select is(
  (select image_url from public.search_cards(p_query => 'OP01-001', p_languages => array['en'])),
  'https://img/en/OP01-001.png', 'representative image prefers the base art');

select is(
  (select printing_count::int from public.search_cards(p_query => 'OP01-001')), 3,
  'printing_count counts every art and language');

select results_eq(
  $$select id from public.search_cards(p_colors => array['Purple'])$$,
  $$values ('OP01-060'::text)$$,
  'color filter matches multicolor cards');

select results_eq(
  $$select id from public.search_cards(p_categories => array['Leader'], p_languages => array['en'], p_cost_min => 5, p_rarities => array['Leader'])$$,
  $$values ('OP01-001'::text), ('OP01-060'::text)$$,
  'category + cost + rarity filters combine');

select is(
  (select count(*)::int from public.search_cards(p_query => 'red')), 0,
  'colors are not part of the text search (use the color filter)');

select results_eq(
  $$select id, total_count::int from public.search_cards(p_languages => array['en'], p_sort => 'cost', p_limit => 2, p_offset => 1)$$,
  $$values ('OP01-025'::text, 6), ('OP01-001'::text, 6)$$,
  'cost sort with pagination reports the full total');

select * from finish();
rollback;
