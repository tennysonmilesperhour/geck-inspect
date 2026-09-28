-- 20260928001246_breeder_label_fidelity recreated geck_data.v_morph_training_canonical
-- with CREATE OR REPLACE VIEW and no WITH clause, which cleared the
-- security_invoker option set on 5 Sep (morph_training_view_security_invoker).
-- The view then ran with its owner's rights, so the row security on the
-- tables beneath it no longer applied to API callers. Restore it.
alter view geck_data.v_morph_training_canonical set (security_invoker = true);
