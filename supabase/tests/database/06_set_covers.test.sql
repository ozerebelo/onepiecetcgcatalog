-- set_covers: one picture per set, chosen by rarity, own cards and alternate art.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select has_function('public', 'set_covers', array['text'], 'set_covers(language) exists');

insert into public.sets (id, language, source_id, code, name, kind, sort_order) values
  ('en-569117', 'en', '569117', 'OP-17', 'THE WORLD’S STRONGEST WARRIORS', 'booster', 569117),
  ('en-569001', 'en', '569001', 'ST-01', 'Straw Hat Crew', 'starter', 569001),
  ('ja-569117', 'ja', '569117', 'OP-17', '最強の戦士たち', 'booster', 569117);
insert into public.cards (id, name_en, category) values
  ('OP17-001', 'Leader A', 'Leader'),
  ('OP17-119', 'Secret B', 'Character'),
  ('OP05-119', 'Old secret', 'Character'),
  ('ST01-001', 'Starter leader', 'Leader'),
  ('ST01-002', 'Starter char', 'Character');
insert into public.printings (id, card_id, language, code, variant, variant_index, set_id, rarity, name, image_url) values
  ('en:OP17-001',    'OP17-001', 'en', 'OP17-001',    'base',     0, 'en-569117', 'Leader',     'Leader A',   'img/leader'),
  ('en:OP17-119',    'OP17-119', 'en', 'OP17-119',    'base',     0, 'en-569117', 'SecretRare', 'Secret B',   'img/sec'),
  ('en:OP17-119_p1', 'OP17-119', 'en', 'OP17-119_p1', 'parallel', 1, 'en-569117', 'SecretRare', 'Secret B',   'img/sec-alt'),
  -- an older card sold in the same pack must not become the cover
  ('en:OP05-119_p2', 'OP05-119', 'en', 'OP05-119_p2', 'parallel', 2, 'en-569117', 'SecretRare', 'Old secret', 'img/old'),
  ('en:ST01-002',    'ST01-002', 'en', 'ST01-002',    'base',     0, 'en-569001', 'Common',     'Starter char', 'img/st-char'),
  ('en:ST01-001',    'ST01-001', 'en', 'ST01-001',    'base',     0, 'en-569001', 'Leader',     'Starter leader', 'img/st-leader'),
  ('ja:OP17-001',    'OP17-001', 'ja', 'OP17-001',    'base',     0, 'ja-569117', 'Leader',     'リーダー', 'img/ja-leader');

set local role anon;
select is((select count(*)::int from public.set_covers('en')), 2, 'one cover per English set');
select is((select printing_id from public.set_covers('en') where set_id = 'en-569117'), 'en:OP17-119_p1',
  'a booster shows its own secret rare, alternate art first');
select is((select printing_id from public.set_covers('en') where set_id = 'en-569001'), 'en:ST01-001',
  'a starter deck shows its leader');
select is((select printing_id from public.set_covers('ja')), 'ja:OP17-001', 'languages are kept apart');
reset role;

set local role authenticated;
select lives_ok($$ select * from public.set_covers('en') $$, 'signed-in users can call it too');
reset role;

select * from finish();
rollback;
