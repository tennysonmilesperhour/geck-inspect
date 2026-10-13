-- Listing-level geck_data tables and views are no longer readable with the
-- public (anon) key. Decision 44 (docs/DECISIONS.md), 13 Oct 2026.
--
-- These hold single third-party marketplace listings, their photos, their
-- sellers and price histories, plus internal operations data (model spend,
-- batch jobs, raw captures). The public key ships in every browser, so a
-- "public read" policy made all of it downloadable by anyone, whatever the
-- pages showed.
--
-- Who still reads them:
--   - geck-data's server (service key; src/lib/supabase/public.ts switched
--     to it on 13 Oct) for its public aggregate pages and its members-only
--     /listings and /sellers pages
--   - signed-in users (authenticated role keeps its grants and policies)
--   - Geck Inspect's backend functions (security definer or service key)
-- Aggregate tables and views (taxonomy, fx rates, combo summaries, market
-- temperature, trait frequencies, external licensed reference images) stay
-- public.
--
-- To undo one object: grant select on geck_data.<name> to anon;

do $$
declare
  obj text;
  objs text[] := array[
    -- single listings, photos, sellers, price history
    'market_listings', 'market_sellers', 'market_lineage', 'market_galleries',
    'market_auctions', 'market_raw_captures',
    'listings', 'listings_history', 'listing_images', 'listing_lineage',
    'listing_status_events', 'listing_views', 'listing_favorites',
    'listing_backfill', 'listing_image_phash_pairs',
    'price_history', 'price_drops', 'price_history_dupes_archive',
    'sellers', 'seller_snapshots', 'sellers_needing_scrape',
    'cross_platform_listings', 'cross_platform_listing_images',
    'cross_platform_observations',
    'auction_results', 'auction_state',
    'breeder_market_v', 'sold_listings_v', 'listing_market_mv',
    'listing_week_mv', 'market_asks_mv', 'v_sold_reconciled',
    'v_recent_combo_sales', 'v_listing_value', 'v_listing_week_price',
    'v_seller_reputation', 'v_cross_platform_arbitrage_pairs',
    'v_listing_labels', 'v_training_pairs', 'v_morph_training',
    'v_morph_training_canonical', 'morph_human_labels',
    -- internal operations
    'anthropic_billing_daily', 'model_invocations', 'v_model_spend_7d',
    'batch_jobs', 'ingest_events', 'morph_eval_runs',
    '_backup_0028_trait_rows'
  ];
begin
  foreach obj in array objs loop
    if to_regclass('geck_data.' || obj) is not null then
      execute format('revoke select on geck_data.%I from anon', obj);
    end if;
  end loop;
end $$;
