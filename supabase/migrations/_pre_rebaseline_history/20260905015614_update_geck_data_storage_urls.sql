-- Uploaded training images were copied into Geck Inspect during the Geck Data
-- consolidation. Point the training view at the active project's public
-- storage endpoint so it does not depend on the paused archive project.
create or replace view geck_data.v_morph_training as
with listing_traits as (
  select
    l.listing_id,
    l.primary_image_url,
    l.all_image_urls,
    l.sex,
    l.maturity,
    l.price,
    l.currency,
    (
      select coalesce(array_agg(t order by t), '{}'::text[])
      from unnest(coalesce(l.trait_array, '{}'::text[])) as t
      where geck_data.is_training_trait(t)
    ) as traits,
    case (('x' || substr(md5(l.listing_id), 1, 2))::bit(8)::int) % 100
      when 0 then 'train'
      when 1 then 'train'
      when 2 then 'train'
      when 3 then 'train'
      when 4 then 'train'
      when 5 then 'train'
      when 6 then 'train'
      when 7 then 'train'
      when 8 then 'train'
      when 9 then 'train'
      else case
        when (('x' || substr(md5(l.listing_id), 1, 2))::bit(8)::int) % 100 < 70
          then 'train'
        when (('x' || substr(md5(l.listing_id), 1, 2))::bit(8)::int) % 100 < 85
          then 'val'
        else 'test'
      end
    end as split
  from geck_data.listings l
  where l.primary_image_url is not null
    and l.is_active is not false
)
select
  primary_image_url as image_url,
  listing_id,
  traits,
  sex,
  maturity,
  price,
  currency,
  'scraper_primary'::text as source,
  split
from listing_traits
where primary_image_url is not null

union all

select
  url as image_url,
  lt.listing_id,
  lt.traits,
  lt.sex,
  lt.maturity,
  lt.price,
  lt.currency,
  'scraper_array'::text as source,
  lt.split
from listing_traits lt,
  lateral unnest(coalesce(lt.all_image_urls, '{}'::text[])) as url
where url is not null
  and url <> lt.primary_image_url

union all

select
  (
    'https://mmuglfphhwlaluyfyxsp.supabase.co/storage/v1/object/public/'
    || li.storage_bucket || '/' || li.storage_path
  ) as image_url,
  case
    when li.listing_id like 'mm_%' then substring(li.listing_id from 4)
    else li.listing_id
  end as listing_id,
  (
    select coalesce(array_agg(t order by t), '{}'::text[])
    from unnest(coalesce(l.trait_array, '{}'::text[])) as t
    where geck_data.is_training_trait(t)
  ) as traits,
  l.sex,
  l.maturity,
  l.price,
  l.currency,
  'uploaded'::text as source,
  case (('x' || substr(md5(li.listing_id), 1, 2))::bit(8)::int) % 100
    when 0 then 'train'
    when 1 then 'train'
    when 2 then 'train'
    when 3 then 'train'
    when 4 then 'train'
    when 5 then 'train'
    when 6 then 'train'
    when 7 then 'train'
    when 8 then 'train'
    when 9 then 'train'
    else case
      when (('x' || substr(md5(li.listing_id), 1, 2))::bit(8)::int) % 100 < 70
        then 'train'
      when (('x' || substr(md5(li.listing_id), 1, 2))::bit(8)::int) % 100 < 85
        then 'val'
      else 'test'
    end
  end as split
from geck_data.listing_images li
left join geck_data.listings l on l.listing_id = (
  case
    when li.listing_id like 'mm_%' then substring(li.listing_id from 4)
    else li.listing_id
  end
);
