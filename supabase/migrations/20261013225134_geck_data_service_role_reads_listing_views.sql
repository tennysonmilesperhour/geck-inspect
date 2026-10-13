-- geck-data's server reads these with the service key since 13 Oct
-- (decision 44). They had been granted to anon and authenticated only,
-- so the service role could not select them.
grant select on geck_data.listing_market_mv to service_role;
grant select on geck_data.listing_week_mv to service_role;
grant select on geck_data.market_asks_mv to service_role;
grant select on geck_data.breeder_market_v to service_role;
grant select on geck_data.v_listing_value to service_role;
grant select on geck_data.cross_platform_traits_mv to service_role;
