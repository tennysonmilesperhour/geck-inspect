// Which photos Morph ID asks for (Tennyson, 29 Sep 2026): a top view and a
// side view are required; up to three more are optional, and a third is
// encouraged. Kept apart from the uploader so the rules can be tested.

export const REQUIRED_VIEWS = [
  { key: 'top', label: 'Top view', hint: 'Straight down on the back, whole gecko in frame' },
  { key: 'side', label: 'Side view', hint: 'Flank from the side, head to tail, legs visible' },
];

export const MAX_EXTRA_VIEWS = 3;

const isReady = (item) => item?.status === 'ready' && !!item.url;

/** Uploaded urls in the order Morph ID should see them: top, side, extras. */
export function orderedViewUrls(slots) {
  return [slots?.top, slots?.side, ...(slots?.extras || [])].filter(isReady).map((i) => i.url);
}

/** True once both required views have finished uploading. */
export function viewsReady(slots) {
  return isReady(slots?.top) && isReady(slots?.side);
}
