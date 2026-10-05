// The save behind Quick Add, shared with the guest-demo hand-off (a gecko
// typed in the demo is saved this way once the account exists).
import { FeedingGroup } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
import { todayLocalISO } from '@/lib/dateUtils';
import { DEFAULT_FEEDING_INTERVAL_DAYS } from '@/lib/firstGeckoFlow';
import { generateNextGeckoId } from './form/helpers';

/**
 * Save one crested gecko through save_gecko_record (the same atomic RPC
 * the full form uses), optionally putting it in the member's first
 * feeding group with reminders on (created if they have none).
 *
 *   fields: { name, sex, hatch_date, morphs_traits, weight_grams,
 *             image_urls, morph_tags, notes }
 *   pool: geckos to count when numbering the ID code
 * Returns { gecko, feedingGroupId }. Throws on failure (the gecko-limit
 * error included, see isGeckoLimitError).
 */
export async function saveQuickGecko({ user, fields, remind = true, pool = [], idSettings = null, requestId }) {
  let feedingGroupId = null;
  if (remind) {
    const groups = await FeedingGroup.filter({ created_by: user.email }).catch(() => []);
    const group = groups[0] || await FeedingGroup.create({
      label: 'A',
      name: 'My geckos',
      diet_type: 'CGD',
      interval_days: DEFAULT_FEEDING_INTERVAL_DAYS,
      last_fed_date: todayLocalISO(),
      feeding_reminder_enabled: true,
    });
    feedingGroupId = group?.id || null;
  }

  // Same ID code the full add form would give a new founder.
  let idCode = null;
  try {
    idCode = await generateNextGeckoId(user, pool, null, null, '', '', idSettings);
  } catch (idErr) {
    console.warn('ID code not generated:', idErr);
  }

  const grams = fields.weight_grams == null || fields.weight_grams === '' ? null : Number(fields.weight_grams);
  const record = {
    name: String(fields.name || '').trim(),
    gecko_id_code: idCode || null,
    sex: fields.sex || 'Unsexed',
    hatch_date: fields.hatch_date || null,
    morphs_traits: (fields.morphs_traits || '').trim() || null,
    image_urls: Array.isArray(fields.image_urls) ? fields.image_urls : [],
    ...(Array.isArray(fields.morph_tags) && fields.morph_tags.length ? { morph_tags: fields.morph_tags } : {}),
    ...(fields.notes ? { notes: fields.notes } : {}),
    species: 'Crested Gecko',
    status: 'Pet',
    is_public: false,
    weight_grams: grams,
    feeding_group_id: feedingGroupId,
  };
  const { data: gecko, error } = await supabase.rpc('save_gecko_record', {
    p_record: record,
    p_request_id: requestId || crypto.randomUUID(),
    p_gecko_id: null,
    p_record_weight: grams !== null,
    p_record_date: todayLocalISO(),
  });
  if (error) throw error;
  // Lets the Dashboard (and any open list) drop its cached counts.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('geckos_changed', { detail: { action: 'created' } }));
  }
  return { gecko, feedingGroupId };
}
