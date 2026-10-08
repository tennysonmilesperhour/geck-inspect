# Advisor exceptions

Recorded with `20261008082521_pin_function_search_path.sql`. That file
is not applied by opening or merging the pull request. The owner
applies it after merge.

## search_path pinned to empty

These functions are `language sql`, security invoker, and they
schema-qualify every object they use. A read-only check showed the
same rows with `search_path` empty and with the default path, so the
pin does not change results:

- `geck_data._age_class(text)`
- `geck_data._sex_class(text)`
- `geck_data._drop_contained(text[])`
- `geck_data.compare_trends(text[])`
- `geck_data.feedle_import_markup()`
- `geck_data.listing_price_history(text)`
- `geck_data.market_compare(integer)`
- `geck_data.market_trend(text)`
- `geck_data.market_weekly(text)`
- `geck_data.match_traits(text)`
- `geck_data.monthly_history(text)`
- `public.season_window_start(text, integer)`
- `public.season_window_end(text, integer)`

## Anon read that stays

`geck-data.vercel.app` reads these with the publishable (anon) key,
either directly or through security invoker RPCs. Anon select stays:

- `geck_data.listing_market_mv`
- `geck_data.listing_week_mv`
- `geck_data.market_asks_mv`
- `geck_data.cross_platform_traits_mv`
- `geck_data.v_sold_reconciled`

The RPCs in front of them are `market_trend`, `market_weekly`,
`compare_trends`, `market_compare`, `sold_price_band`,
`v_regional_heatmap`, and `data_health`.

## Revoked from anon and authenticated

No public reader. A search of this repo and of `geck-data` (application
code, tests, and scripts, skipping migration history and docs) found
no anon or authenticated client of:

- `geck_data.combo_index_daily`
- `geck_data.combo_weekly_prices_mv`
- `geck_data.v_observed_traits`
- `geck_data.combo_index_movers`
- `geck_data.combo_weekly_prices`
- `geck_data.v_combo_index_summary`

The only in-repo hit outside migrations is
`supabase/tests/market_combo_regressions.sql`, which calls
`geck_data.combo_weekly_prices(...)` as SQL. That test is not a Data
API client. The three revokes stay.

## Trigger execute revoked

`public.notify_admins_of_deletion_request()` is the trigger function
created in `20261003220000_account_erasure.sql`. It returns `trigger`
and takes no arguments. Execute is revoked from `public`, `anon`, and
`authenticated`, the same way
`20261008063704_lock_security_definer_execute.sql` locks the other
trigger functions.

`support_messages_deletion_request_alert` keeps firing. Postgres
checks `EXECUTE` when the trigger is created, not each time the
trigger runs.
