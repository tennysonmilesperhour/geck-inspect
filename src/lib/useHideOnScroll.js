import { useEffect, useState } from 'react';

// Hides a bar while the user scrolls down and shows it again on the first
// scroll up. Used by the phone bottom bar in Layout.jsx so the page gets the
// whole screen while reading. Small moves (under `threshold` px) are ignored
// so a shaky thumb does not make the bar flicker, and the bar always shows
// near the top of the page. `el` is the scrolling element (pass it from a
// callback ref so the hook attaches once the element mounts).
export function useHideOnScroll(el, { threshold = 8, topOffset = 48, resetKey } = {}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
    if (!el) return undefined;

    let last = el.scrollTop;
    let frame = 0;

    const update = () => {
      frame = 0;
      const top = el.scrollTop;
      // iOS rubber-banding past the end reports values outside the range.
      const max = el.scrollHeight - el.clientHeight;
      if (top < 0 || top > max) return;
      if (top <= topOffset) {
        setHidden(false);
        last = top;
        return;
      }
      const delta = top - last;
      if (Math.abs(delta) < threshold) return;
      setHidden(delta > 0);
      last = top;
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [el, threshold, topOffset, resetKey]);

  return [hidden, setHidden];
}
