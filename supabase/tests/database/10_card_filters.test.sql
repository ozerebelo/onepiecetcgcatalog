-- Search filters: type, attribute, counter, power, trigger, keywords, effect words; card type list.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into public.sets (id, language, source_id, code, name, kind, sort_order) values
  ('en-569101', 'en', '569101', 'OP-01', 'ROMANCE DAWN', 'booster', 569101);
insert into public.cards (id, name_en, name_ja, category, colors, cost, power, counter, attributes, types, effect, trigger) values
  ('OP01-024', 'Monkey.D.Luffy', null, 'Character', '{Red}', 2, 3000, 1000, '{Strike}', '{Supernovas,Straw Hat Crew}',
   '[Rush] (This card can attack on the turn in which it is played.)', null),
  ('OP01-016', 'Nami', null, 'Character', '{Red}', 1, 2000, 2000, '{Special}', '{Straw Hat Crew}',
   '[On Play] Look at 5 cards from the top of your deck.', '[Trigger] Play this card.'),
  ('OP01-029', 'Radical Beam!!', null, 'Event', '{Red}', 1, null, null, '{}', '{Straw Hat Crew}',
   '[Counter] Up to 1 of your Leader or Character cards gains +2000 power during this battle.', null),
  ('OP01-047', 'Trafalgar Law', null, 'Character', '{Green}', 5, 6000, null, '{Slash}', '{Heart Pirates,Supernovas}',
   '[Blocker] [On Play] You may return 1 of your Characters to the owner''s hand.', null);
insert into public.printings (id, card_id, language, code, variant, variant_index, set_id, rarity, name, image_url) values
  ('en:OP01-024', 'OP01-024', 'en', 'OP01-024', 'base', 0, 'en-569101', 'SuperRare', 'Monkey.D.Luffy', 'x'),
  ('en:OP01-016', 'OP01-016', 'en', 'OP01-016', 'base', 0, 'en-569101', 'Rare', 'Nami', 'x'),
  ('en:OP01-029', 'OP01-029', 'en', 'OP01-029', 'base', 0, 'en-569101', 'Uncommon', 'Radical Beam!!', 'x'),
  ('en:OP01-047', 'OP01-047', 'en', 'OP01-047', 'base', 0, 'en-569101', 'SuperRare', 'Trafalgar Law', 'x');

select set_eq($$select id from public.search_cards(p_types => array['Supernovas'])$$,
  $$values ('OP01-024'), ('OP01-047')$$, 'type: any of the given types');
select set_eq($$select id from public.search_cards(p_attributes => array['Slash', 'Special'])$$,
  $$values ('OP01-016'), ('OP01-047')$$, 'attribute');
select set_eq($$select id from public.search_cards(p_counters => array[0])$$,
  $$values ('OP01-029'), ('OP01-047')$$, 'counter 0 = no counter');
select set_eq($$select id from public.search_cards(p_counters => array[2000])$$, $$values ('OP01-016')$$, 'counter +2000');
select set_eq($$select id from public.search_cards(p_power_min => 3000, p_power_max => 6000)$$,
  $$values ('OP01-024'), ('OP01-047')$$, 'power range');
select set_eq($$select id from public.search_cards(p_has_trigger => true)$$, $$values ('OP01-016')$$, 'has a Trigger');
select set_eq($$select id from public.search_cards(p_keywords => array['Blocker', 'On Play'])$$,
  $$values ('OP01-047')$$, 'every keyword must be present');
select set_eq($$select id from public.search_cards(p_keywords => array['On Play'])$$,
  $$values ('OP01-016'), ('OP01-047')$$, 'keyword');
select set_eq($$select id from public.search_cards(p_effect => 'return hand')$$, $$values ('OP01-047')$$, 'effect words');
select set_eq($$select id from public.search_cards(p_effect => 'look play')$$, $$values ('OP01-016')$$,
  'effect words can match across the effect and the trigger text');
select results_eq($$select type, cards::int from public.card_types('en') where type = 'Straw Hat Crew'$$,
  $$values ('Straw Hat Crew'::text, 3)$$, 'card types with counts');

select * from finish();
rollback;
