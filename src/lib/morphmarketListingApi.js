import { getSupabase } from './supabaseLazy';

export async function loadMorphMarketListings() {
  const supabase = await getSupabase();
  const rows = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await supabase.from('morphmarket_listing_details').select('*').order('gecko_id').range(offset, offset + 199);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 200) return rows;
  }
}

export async function saveMorphMarketListing(geckoId, source, draft, extra, filename, expectedUpdatedDate) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('save_morphmarket_listing', {
    p_gecko_id: geckoId, p_source_fields: source, p_draft_fields: draft,
    p_source_extra: extra, p_source_name: filename,
    p_expected_updated_date: expectedUpdatedDate || null,
  });
  if (error) throw error;
  return data;
}

export async function importMorphMarketListing(record, source, filename, requestId) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('import_morphmarket_listing', {
    p_record: record, p_source_fields: source.fields, p_source_extra: { ...source.extra, original_fields: source.raw },
    p_source_name: filename, p_request_id: requestId,
  });
  if (error) throw error;
  return data;
}
