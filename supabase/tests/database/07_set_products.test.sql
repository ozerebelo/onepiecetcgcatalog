-- Product details on sets: release date and pack image.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select has_column('public', 'sets', 'release_date', 'sets.release_date exists');
select col_type_is('public', 'sets', 'release_date', 'date', 'release_date is a date');
select has_column('public', 'sets', 'image_url', 'sets.image_url exists');
select has_column('public', 'sets', 'source_image_url', 'sets.source_image_url exists');

insert into public.sets (id, language, source_id, code, name, kind, sort_order, release_date, image_url, source_image_url)
  values ('en-569117', 'en', '569117', 'OP-17', 'THE WORLD’S STRONGEST WARRIORS', 'booster', 569117,
          '2026-08-28', 'https://storage/sets/en/OP-17.webp', 'https://official/op17.webp');

set local role anon;
select is((select release_date from public.sets where id = 'en-569117'), '2026-08-28'::date,
  'visitors can read release dates');
select is((select image_url from public.sets where id = 'en-569117'), 'https://storage/sets/en/OP-17.webp',
  'visitors can read pack images');
reset role;

select * from finish();
rollback;
