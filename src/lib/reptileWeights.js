// Other Reptiles weigh-ins (audit step 31).
//
// Weights used to live only as text in an event's notes ("Weight: 45g"),
// so they could not be charted reliably (the old parser also dropped
// decimals). New weigh-ins store the number in reptile_events.weight_grams
// and keep the note for older app versions. Older rows without the column
// fall back to reading the note, until the backfill migration runs.

export const WEIGHT_EVENT_NAME = 'Weight Check';

/** Parse "Weight: 45.5g" out of a note. Returns null when there is none. */
export function parseWeightNote(notes) {
  if (typeof notes !== 'string') return null;
  const match = notes.match(/Weight:\s*(\d+(?:[.,]\d+)?)\s*g?/i);
  if (!match) return null;
  const grams = Number(match[1].replace(',', '.'));
  return Number.isFinite(grams) && grams > 0 ? grams : null;
}

/**
 * The reptile's own weight recorded by an event, or null. Feeding events
 * are skipped: their "Weight:" note is the prey's weight, not the animal's.
 */
export function reptileEventWeight(event) {
  if (!event) return null;
  const stored = Number(event.weight_grams);
  if (event.weight_grams != null && Number.isFinite(stored) && stored > 0) return stored;
  if (event.event_type === 'feeding') return null;
  if (event.event_type !== 'weight' && event.custom_event_name !== WEIGHT_EVENT_NAME) return null;
  return parseWeightNote(event.notes);
}

/** Weight records (newest first, same order as the events) for charting. */
export function reptileWeightRecords(events) {
  return (events || [])
    .map((e) => ({ id: e.id, record_date: e.event_date, weight_grams: reptileEventWeight(e) }))
    .filter((w) => w.weight_grams != null);
}

/** Row to insert for a new weigh-in. */
export function newReptileWeightEvent(reptileId, grams, when = new Date()) {
  return {
    reptile_id: reptileId,
    event_type: 'custom',
    custom_event_name: WEIGHT_EVENT_NAME,
    event_date: when.toISOString(),
    weight_grams: grams,
    notes: `Weight: ${grams}g`,
  };
}
