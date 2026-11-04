-- Product details from the official product pages: release date and pack image.
--
-- The card dataset has neither, so the importer reads them from the official "Products" list
-- (en.onepiece-cardgame.com / www.onepiece-cardgame.com) and copies each pack image into Storage,
-- like card images. All three stay null for products that list has no entry for (promos, "other").

alter table public.sets
  add column release_date date,
  -- displayed pack image: our Storage copy once mirrored, otherwise the official address
  add column image_url text,
  -- official pack image address (import source)
  add column source_image_url text;

comment on column public.sets.release_date is 'Release date from the official product list (null when unknown).';
comment on column public.sets.image_url is 'Pack / box image shown in the apps (Storage copy once mirrored).';
comment on column public.sets.source_image_url is 'Official pack image address the importer copies from.';

-- Newest products first, on the Cards page.
create index sets_language_release_idx on public.sets (language, release_date desc nulls last);
