// One-shot image fallback for <img onError>.
//
// The old pattern, `e.target.onerror = null; e.target.src = fallback`, does
// nothing useful in React: onError is React's own listener, not the DOM
// property, so clearing the property never removes it. When the fallback
// image also failed (offline, blocked host, wrong URL), onError fired again,
// set the same src again, and the browser retried forever. This helper marks
// the image the first time it swaps, so the swap happens at most once.
export function swapToFallback(event, fallbackSrc) {
  const img = event?.currentTarget || event?.target;
  if (!img || img.dataset.fallbackApplied === '1') return;
  img.dataset.fallbackApplied = '1';
  if (fallbackSrc && img.getAttribute('src') !== fallbackSrc) {
    img.src = fallbackSrc;
  }
}
