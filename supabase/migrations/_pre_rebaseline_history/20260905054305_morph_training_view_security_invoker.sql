-- Keep the canonical training-data view subject to the caller's permissions
-- and row-level security instead of the view owner's privileges.

alter view geck_data.v_morph_training_canonical
  set (security_invoker = true);
