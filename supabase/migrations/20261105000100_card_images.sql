-- =============================================================================
-- Card images are served from our own storage.
--
-- The official card-list site does not allow its images to be embedded on other
-- websites, so the import job copies each image once (resized to WebP) into the
-- public Storage bucket "card-images" (created by the importer).
--
--   source_image_url  official image address (what the importer downloads from)
--   image_url         what the apps display: our copy once mirrored, until then
--                     the official address
--
-- The importer keeps image_url pointing at the copy across daily refreshes, and
-- falls back to the official address if the official image ever changes.
-- =============================================================================

alter table public.printings add column source_image_url text;
update public.printings set source_image_url = image_url;
alter table public.printings alter column source_image_url set not null;

-- Writers that don't know about the new column (older scripts, manual inserts) still work:
-- a missing source address defaults to the displayed one.
create or replace function public.printings_default_source_image()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.source_image_url := coalesce(new.source_image_url, new.image_url);
  return new;
end;
$$;

create trigger printings_default_source_image before insert on public.printings
  for each row execute function public.printings_default_source_image();

comment on column public.printings.source_image_url is 'Official image address (import source).';
comment on column public.printings.image_url is 'Image address the apps display: our Storage copy once mirrored, otherwise the official address.';

-- The importer looks up printings that still need their image copied.
create index printings_unmirrored_idx on public.printings (id) where image_url = source_image_url;
