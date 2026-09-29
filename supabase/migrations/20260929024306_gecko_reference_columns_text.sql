-- geckos.id is text, and 240 of 341 geckos (29 Sep 2026) carry ids from the
-- old platform that are not UUIDs. pending_sales.gecko_id was uuid, so
-- creating a reserve for any of those geckos failed with "invalid input
-- syntax for type uuid". shipping_orders.gecko_ids had the same problem
-- (the shipping screens are hidden, but the column should match).
alter table public.pending_sales alter column gecko_id type text using gecko_id::text;
alter table public.shipping_orders alter column gecko_ids type text[] using gecko_ids::text[];
