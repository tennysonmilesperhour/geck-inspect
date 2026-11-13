/**
 * The unsaved NEW gecko a member was typing into the long form, kept in
 * this browser so a closed tab or a reload does not lose it (experience
 * review D3). Next time the long add form opens it offers "Pick up where
 * you left off?".
 *
 * What is kept: text and choices, and the addresses of photos that were
 * already uploaded. Never photo files. One draft per member, under the
 * member's id, and never for a guest in the demo. It is cleared when the
 * gecko is saved, when the member discards the form, and after two weeks.
 */
import { isGuestMode } from '@/lib/guestMode';

const KEY_PREFIX = 'geck_gecko_form_draft_v1:';
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

// The form fields a draft may carry. Anything else is dropped on the way
// in and on the way out, so a stale or edited draft can never put an
// unexpected value into the form.
const TEXT_FIELDS = [
  'name', 'gecko_id_code', 'sex', 'species', 'morphs_traits', 'notes', 'status',
  'asking_price', 'marketplace_description', 'weight_grams', 'tail_status',
  'feeding_group_id', 'collection_id', 'gravid_since', 'egg_drop_date', 'placeholder_style',
];
const FLAG_FIELDS = ['is_public', 'gallery_display', 'is_gravid', 'growth_slideshow_enabled'];
const isUploadedUrl = (url) => typeof url === 'string' && /^https?:\/\//.test(url);

function storageKey(user) {
  if (!user || user.is_guest || isGuestMode()) return null;
  const who = user.id || String(user.email || '').trim().toLowerCase();
  return who ? `${KEY_PREFIX}${who}` : null;
}

function cleanForm(form) {
  const out = {};
  if (!form || typeof form !== 'object') return out;
  for (const key of TEXT_FIELDS) {
    const value = form[key];
    if (typeof value === 'string' && value.length <= 5000) out[key] = value;
    else if (value === null) out[key] = null;
  }
  for (const key of FLAG_FIELDS) {
    if (typeof form[key] === 'boolean') out[key] = form[key];
  }
  if (typeof form.quality_score === 'number' && Number.isFinite(form.quality_score)) out.quality_score = form.quality_score;
  if (Array.isArray(form.morph_tags)) {
    out.morph_tags = form.morph_tags.filter((tag) => typeof tag === 'string' && tag.length <= 80).slice(0, 60);
  }
  out.image_urls = Array.isArray(form.image_urls) ? form.image_urls.filter(isUploadedUrl).slice(0, 40) : [];
  return out;
}

function cleanDraft(draft) {
  if (!draft || typeof draft !== 'object') return null;
  const form = cleanForm(draft.form);
  const text = (value) => (typeof value === 'string' ? value.slice(0, 200) : '');
  // Crop, life-stage and fire-state choices, only for photos still in the draft.
  const crop = {};
  if (draft.crop && typeof draft.crop === 'object') {
    for (const url of form.image_urls) {
      if (draft.crop[url] && typeof draft.crop[url] === 'object') crop[url] = draft.crop[url];
    }
  }
  return {
    form,
    hatch: { year: text(draft.hatch?.year), month: text(draft.hatch?.month), day: text(draft.hatch?.day) },
    sire: { input: text(draft.sire?.input), id: text(draft.sire?.id) },
    dam: { input: text(draft.dam?.input), id: text(draft.dam?.id) },
    crop,
  };
}

/** True when the draft holds something worth offering back. */
export function draftHasContent(draft) {
  const form = draft?.form || {};
  return Boolean(
    String(form.name || '').trim()
    || String(form.morphs_traits || '').trim()
    || String(form.notes || '').trim()
    || (form.morph_tags || []).length
    || (form.image_urls || []).length
    || form.weight_grams
    || draft?.hatch?.year
    || draft?.sire?.input
    || draft?.dam?.input,
  );
}

/** Keep the draft for this member. Returns false for a guest or when storage is blocked. */
export function saveGeckoFormDraft(user, draft, now = Date.now()) {
  const key = storageKey(user);
  const clean = cleanDraft(draft);
  if (!key || !clean || !draftHasContent(clean)) return false;
  try {
    localStorage.setItem(key, JSON.stringify({ saved_at: now, draft: clean }));
    return true;
  } catch {
    return false;
  }
}

/** This member's unfinished gecko, or null (also null once it is two weeks old). */
export function readGeckoFormDraft(user, now = Date.now()) {
  const key = storageKey(user);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || now - Number(parsed.saved_at || 0) > MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    const clean = cleanDraft(parsed.draft);
    return clean && draftHasContent(clean) ? clean : null;
  } catch {
    return null;
  }
}

export function clearGeckoFormDraft(user) {
  const key = storageKey(user);
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // storage blocked
  }
}
