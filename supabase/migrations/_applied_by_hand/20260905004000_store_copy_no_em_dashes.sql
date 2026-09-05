-- Store copy: replace em dashes in product names and descriptions.
--
-- 21 product names ("Tee — Got CGD?"), one short description and one long
-- description carried em dashes into the live store. Names use a colon,
-- prose uses a comma, matching the swept seed files. Applied to
-- production by hand on 2026-09-05.

update public.store_products
set name = regexp_replace(name, '\s*—\s*', ': ', 'g')
where name like '%—%';

update public.store_products
set short_description = regexp_replace(short_description, '\s*—\s*', ': ', 'g')
where short_description like '%—%';

update public.store_products
set long_description_md = regexp_replace(long_description_md, '\s*—\s*', ', ', 'g')
where long_description_md like '%—%';
