-- Market prices froze on 1 October 2026.
--
-- The new detail scraper (geck-data scripts/scrape_details.py) upserts
-- listings without a species, so new rows took the column default
-- 'crested-gecko'. Every reader in both repos keeps rows where species is
-- 'crested' or unknown: trait_value_table() (gecko value estimates),
-- market_tape, market_analytics_v2, the geck_data summaries and the
-- materialized views. So all 5,092 listings first seen since 30 September
-- were invisible, and value estimates stopped moving.
--
-- geck-data's own canonical code (scripts/lib/canonical.py infer_species)
-- already maps 'crested-gecko' to 'crested'. This makes the table do the
-- same, once, instead of teaching some 40 readers a second spelling.

-- The column default stays 'crested-gecko': changing it needs an exclusive
-- lock that the live scraper traffic kept from being granted (the attempt
-- timed out twice on 5 Oct). The trigger below rewrites the default on every
-- insert, so the default no longer matters.

create or replace function geck_data._normalize_listing_species()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.species is not null
     and lower(trim(new.species)) in ('crested-gecko', 'crested gecko', 'correlophus ciliatus') then
    new.species := 'crested';
  end if;
  return new;
end;
$$;

drop trigger if exists listings_normalize_species on geck_data.listings;
create trigger listings_normalize_species
  before insert or update of species on geck_data.listings
  for each row execute function geck_data._normalize_listing_species();

-- Applied in batches of 500 to 2,500 rows on 5 Oct (5,092 rows in all).
update geck_data.listings
   set species = 'crested'
 where lower(trim(species)) in ('crested-gecko', 'crested gecko', 'correlophus ciliatus');
