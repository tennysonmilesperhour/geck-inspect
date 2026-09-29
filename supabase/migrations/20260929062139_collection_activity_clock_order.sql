-- Several entries written in one save (a weigh-in and the edit that copies
-- the weight onto the gecko, say) share the transaction's now(), so the
-- feed could not order them. Use the wall clock instead.
alter table public.collection_activity alter column created_at set default clock_timestamp();
