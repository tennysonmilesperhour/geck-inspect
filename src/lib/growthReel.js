/**
 * Pure helpers for the Growth Reel: turning a gecko's photo history into
 * an ordered, captioned frame sequence. No DOM, no network, no React, so
 * everything here is unit-testable and reusable (the share card generator
 * and the public profile slideshow can lean on the same logic later).
 *
 * Data model recap:
 *   gecko.image_urls       string[] of photo URLs, roughly chronological
 *                          (upload order). We do not store a capture date
 *                          per photo.
 *   gecko.image_crop_data  jsonb keyed by URL. Relevant keys per photo:
 *                          rotation (degrees) and life_stage (one of
 *                          LIFE_STAGE_ORDER, set in the edit form).
 *   gecko.hatch_date       ISO date string, may be missing.
 *   WeightRecord           { record_date, weight_grams } rows, already
 *                          filtered to this gecko by the caller.
 */

// Timing constants shared by the in-app player and the webm export.
export const PLAYER_FRAME_MS = 1800; // per-frame hold at 1x in the player
export const EXPORT_FRAME_MS = 1600; // per-frame hold in the exported clip
export const EXPORT_CROSSFADE_MS = 450; // overlap between exported frames
export const EXPORT_TAIL_HOLD_MS = 600; // hold on the last frame before stop

// Mirrors the life-stage vocabulary in components/my-geckos/form/constants.js.
export const LIFE_STAGE_ORDER = ['hatchling', '3mo', '6mo', '1yr', '2yr', 'adult'];

const MS_PER_DAY = 86400000;

/**
 * Orders a gecko's photos into reel frames: [{ url, rotation, lifeStage }].
 *
 * image_urls is treated as roughly chronological (upload order), which is
 * the default ordering. If the keeper has tagged EVERY photo with a
 * life_stage, those tags are a stronger signal than upload order, so we
 * sort by stage instead (stable, so same-stage photos keep their relative
 * order). A partially tagged set stays in upload order, because mixing the
 * two orderings would let one tagged photo jump the whole sequence.
 */
export function orderReelFrames(gecko) {
  const urls = Array.isArray(gecko?.image_urls) ? gecko.image_urls.filter(Boolean) : [];
  const cropData = gecko?.image_crop_data || {};
  const frames = urls.map((url, originalIndex) => ({
    url,
    rotation: cropData[url]?.rotation || 0,
    lifeStage: cropData[url]?.life_stage || null,
    originalIndex,
  }));

  const allTagged =
    frames.length > 0 &&
    frames.every((f) => f.lifeStage && LIFE_STAGE_ORDER.includes(f.lifeStage));

  if (allTagged) {
    frames.sort(
      (a, b) =>
        LIFE_STAGE_ORDER.indexOf(a.lifeStage) - LIFE_STAGE_ORDER.indexOf(b.lifeStage) ||
        a.originalIndex - b.originalIndex,
    );
  }

  return frames.map(({ url, rotation, lifeStage }) => ({ url, rotation, lifeStage }));
}

/**
 * Estimates each frame's age in days.
 *
 * APPROXIMATION: photos do not carry a capture date, so we assume the
 * sequence is spread evenly between hatch_date and "now". Frame 0 is
 * treated as day 0 (a hatchling photo) and the last frame as today.
 * That is obviously a simplification (nobody uploads on a perfect
 * schedule), but it produces captions that are directionally right for
 * the common case of "I added a photo every few months as it grew", and
 * it degrades gracefully: with no hatch_date we return nulls and the
 * player simply drops the age captions.
 *
 * Returns an array of length frameCount with age-in-days numbers, or
 * nulls when hatch_date is missing/invalid/in the future.
 */
export function estimateFrameAgesDays(frameCount, hatchDate, now = new Date()) {
  const empty = Array.from({ length: Math.max(0, frameCount) }, () => null);
  if (!frameCount || frameCount < 1 || !hatchDate) return empty;
  const hatch = new Date(hatchDate);
  if (Number.isNaN(hatch.getTime())) return empty;
  const totalDays = (now.getTime() - hatch.getTime()) / MS_PER_DAY;
  if (totalDays < 0) return empty;
  if (frameCount === 1) return [totalDays];
  return empty.map((_, i) => (totalDays * i) / (frameCount - 1));
}

/**
 * Formats an age in days the way keepers talk about it:
 * "Hatchling", "18 days", "4 months", "1 year", "2.5 years".
 */
export function formatAge(ageDays) {
  if (ageDays == null || !Number.isFinite(ageDays) || ageDays < 0) return null;
  if (ageDays < 2) return 'Hatchling';
  if (ageDays < 60) return `${Math.round(ageDays)} days`;
  const months = Math.floor(ageDays / 30.44);
  if (months < 24) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.round((ageDays / 365.25) * 10) / 10;
  const label = Number.isInteger(years) ? String(years) : years.toFixed(1);
  return `${label} year${years === 1 ? '' : 's'}`;
}

/**
 * Finds the weight record closest in time to targetDate.
 * Records further than maxDistanceDays away are ignored so a frame from
 * month 2 never gets captioned with an adult weight taken a year later.
 * Returns weight_grams (number) or null.
 */
export function nearestWeight(weights, targetDate, maxDistanceDays = 60) {
  if (!Array.isArray(weights) || weights.length === 0 || !targetDate) return null;
  const target = new Date(targetDate).getTime();
  if (Number.isNaN(target)) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const record of weights) {
    if (record?.weight_grams == null || !record.record_date) continue;
    const recorded = new Date(record.record_date).getTime();
    if (Number.isNaN(recorded)) continue;
    const distance = Math.abs(recorded - target) / MS_PER_DAY;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = record;
    }
  }
  if (!best || bestDistance > maxDistanceDays) return null;
  return best.weight_grams;
}

/** Joins age and weight into one caption line, e.g. "4 months · 12g". */
export function frameCaption(ageLabel, weightGrams) {
  const parts = [];
  if (ageLabel) parts.push(ageLabel);
  if (weightGrams != null) parts.push(`${weightGrams}g`);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * The one-stop assembly used by <GrowthReel />: ordered frames, each with
 * { url, rotation, lifeStage, ageDays, ageLabel, weightGrams, caption }.
 */
export function buildReelFrames(gecko, weights = [], now = new Date()) {
  const ordered = orderReelFrames(gecko);
  const ages = estimateFrameAgesDays(ordered.length, gecko?.hatch_date, now);
  const hatchMs = gecko?.hatch_date ? new Date(gecko.hatch_date).getTime() : NaN;

  return ordered.map((frame, i) => {
    const ageDays = ages[i];
    const ageLabel = formatAge(ageDays);
    const estimatedDate =
      ageDays != null && !Number.isNaN(hatchMs)
        ? new Date(hatchMs + ageDays * MS_PER_DAY)
        : null;
    const weightGrams = estimatedDate ? nearestWeight(weights, estimatedDate) : null;
    return {
      ...frame,
      ageDays,
      ageLabel,
      weightGrams,
      caption: frameCaption(ageLabel, weightGrams),
    };
  });
}
