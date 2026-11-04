-- Card image columns: official source address kept separately from the displayed address.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select has_column('public', 'printings', 'source_image_url', 'printings.source_image_url exists');
select col_not_null('public', 'printings', 'source_image_url', 'source_image_url is required');
select has_index('public', 'printings', 'printings_unmirrored_idx', 'index for finding images still to copy');

insert into public.sets (id, language, source_id, code, name, kind, sort_order)
  values ('en-569101', 'en', '569101', 'OP-01', 'ROMANCE DAWN', 'booster', 569101);
insert into public.cards (id, name_en, category) values ('OP01-001', 'Roronoa Zoro', 'Leader');
insert into public.printings (id, card_id, language, code, variant, variant_index, set_id, rarity, name, image_url, source_image_url)
  values ('en:OP01-001', 'OP01-001', 'en', 'OP01-001', 'base', 0, 'en-569101', 'Leader', 'Roronoa Zoro',
          'https://official/OP01-001.png', 'https://official/OP01-001.png');

set local role anon;
select is(
  (select source_image_url from public.printings where id = 'en:OP01-001'),
  'https://official/OP01-001.png', 'the new column is readable like the rest of the catalog');
reset role;

select * from finish();
rollback;
