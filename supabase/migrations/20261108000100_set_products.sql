-- Product details from the official product pages: release date and the set's key artwork.
--
-- The card dataset has neither, so the importer reads them from the official "Products" pages
-- (en.onepiece-cardgame.com / www.onepiece-cardgame.com): the release date from the product list, and
-- the artwork shown on each product's own page (the illustration printed on the pack, without the
-- packaging), which it copies into Storage like card images. All three stay null for products the
-- list has no entry for (promos, "other") or whose page has no such artwork.

alter table public.sets
  add column release_date date,
  -- displayed artwork: our Storage copy (landscape 800x600), null until copied
  add column image_url text,
  -- official artwork address (import source)
  add column source_image_url text;

comment on column public.sets.release_date is 'Release date from the official product list (null when unknown).';
comment on column public.sets.image_url is 'Set artwork shown in the apps (Storage copy).';
comment on column public.sets.source_image_url is 'Official artwork address the importer copies from.';

-- Newest products first, on the Cards page.
create index sets_language_release_idx on public.sets (language, release_date desc nulls last);
