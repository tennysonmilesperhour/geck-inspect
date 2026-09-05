-- Respect the RLS policies on the public-read source tables when the training
-- view is queried through the Data API.
alter view geck_data.v_morph_training set (security_invoker = true);
