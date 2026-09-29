/**
 * Fired-up and fired-down photo slots.
 *
 * A crested gecko can look like two different animals: fired up (dark,
 * saturated, usually at night or when active) and fired down (pale, usually
 * resting in the day). Buyers ask to see both, so each gecko has one photo
 * slot for each state.
 *
 * No new column: the tag lives in the per-photo metadata the edit form
 * already saves, image_crop_data[url].fire_state, next to the crop, rotation
 * and life-stage tag. Each state belongs to at most one photo, so tagging a
 * new fired-up photo takes the tag off the old one.
 *
 * The ids and labels match Morph ID's FIRED_STATES
 * (src/components/morph-id/morphTaxonomy.js); a test keeps them in step
 * without pulling the whole taxonomy into the passport page.
 */

export const FIRE_SLOTS = [
  {
    id: 'fired_up',
    label: 'Fired up',
    hint: 'Darkest, most saturated colors. Usually at night or when active.',
  },
  {
    id: 'fired_down',
    label: 'Fired down',
    hint: 'Palest colors. Usually resting during the day.',
  },
];

const SLOT_IDS = new Set(FIRE_SLOTS.map((s) => s.id));

/** Fire state tagged on one photo, or '' when untagged. */
export function photoFireState(cropData, url) {
  const state = cropData?.[url]?.fire_state;
  return SLOT_IDS.has(state) ? state : '';
}

/**
 * The photo in each slot: { fired_up: url | null, fired_down: url | null }.
 * Only photos still on the gecko count, and if older data tags two photos
 * with the same state, the first in photo order wins.
 */
export function fireStatePhotos(gecko) {
  const slots = { fired_up: null, fired_down: null };
  const urls = Array.isArray(gecko?.image_urls) ? gecko.image_urls : [];
  for (const url of urls) {
    const state = photoFireState(gecko?.image_crop_data, url);
    if (state && !slots[state]) slots[state] = url;
  }
  return slots;
}

/** True when at least one slot has a photo. */
export function hasFireStatePhotos(gecko) {
  const slots = fireStatePhotos(gecko);
  return Boolean(slots.fired_up || slots.fired_down);
}

/**
 * Returns new crop data with `state` on `url` and off every other photo.
 * An empty state clears the tag from `url`. New entries get the default
 * centered crop the form uses.
 */
export function assignFireState(cropData, url, state) {
  const next = { ...(cropData || {}) };
  const wanted = SLOT_IDS.has(state) ? state : '';
  if (wanted) {
    for (const [other, meta] of Object.entries(next)) {
      if (other !== url && meta?.fire_state === wanted) {
        const { fire_state: _dropped, ...rest } = meta;
        next[other] = rest;
      }
    }
  }
  const { fire_state: _old, ...current } = next[url] || { x: 50, y: 50 };
  next[url] = wanted ? { ...current, fire_state: wanted } : current;
  return next;
}
