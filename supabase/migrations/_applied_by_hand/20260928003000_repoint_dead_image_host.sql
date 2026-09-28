-- Applied by hand on 28 Sep 2026 (data only, no schema change).
--
-- 1,872 scraped MorphMarket photos in public.gecko_images (the second photo
-- of each listing, the ones without an embedding) still pointed at the old
-- geck-data Supabase project, dhotmtgryuovkmsncdby. That project was deleted
-- after the 4 Sep consolidation and its host no longer resolves, so every one
-- of those links was dead. The same files live in this project's
-- listing-images bucket (all 1,872 found in storage.objects), so the host is
-- swapped. Rows are only touched when the file exists here.

update public.gecko_images g
   set image_url = replace(g.image_url, 'https://dhotmtgryuovkmsncdby.supabase.co/', 'https://mmuglfphhwlaluyfyxsp.supabase.co/')
 where g.image_url like 'https://dhotmtgryuovkmsncdby.supabase.co/storage/v1/object/public/listing-images/%'
   and exists (
     select 1 from storage.objects o
      where o.bucket_id = 'listing-images'
        and o.name = substring(g.image_url from '/listing-images/(.*)$'));
