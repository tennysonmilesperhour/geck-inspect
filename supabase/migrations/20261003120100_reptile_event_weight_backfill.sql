-- NOT APPLIED YET. It writes to members' existing rows, so it waits for
-- Tennyson (audit step 31).
--
-- Copies the number out of older Other Reptiles weigh-ins ("Weight: 45g"
-- in notes, custom event "Weight Check") into reptile_events.weight_grams,
-- which 20261003022633 added. The app already reads the note as a
-- fallback, so this only makes the column complete for charts and
-- exports. Feeding events are skipped: their "Weight:" note is the prey.
-- Idempotent: only rows with no weight_grams yet are touched.

update public.reptile_events
   set weight_grams = replace(substring(notes from '(?i)weight:\s*([0-9]+(?:[.,][0-9]+)?)'), ',', '.')::numeric
 where weight_grams is null
   and coalesce(event_type, '') <> 'feeding'
   and (event_type = 'weight' or custom_event_name = 'Weight Check')
   and notes ~* 'weight:\s*[0-9]'
   and replace(substring(notes from '(?i)weight:\s*([0-9]+(?:[.,][0-9]+)?)'), ',', '.')::numeric > 0;
