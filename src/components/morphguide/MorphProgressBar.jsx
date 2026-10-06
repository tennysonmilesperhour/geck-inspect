import { useEffect, useRef } from 'react';

/**
 * A thin bar along the top of the screen that fills as you read the
 * morph page. `targetRef` is the element that counts as "the page" (the
 * article); progress is how far its bottom has come up the screen.
 *
 * It listens to scrolling anywhere (capture phase), because on the
 * public site the window scrolls but inside the app the content pane
 * does. The width is written straight to the element, so scrolling
 * never re-renders React.
 */
export default function MorphProgressBar({ targetRef }) {
  const barRef = useRef(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = targetRef.current;
      const bar = barRef.current;
      if (!el || !bar) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const done = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
      bar.style.transform = `scaleX(${done})`;
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [targetRef]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[3px]">
      <div
        ref={barRef}
        className="h-full origin-left bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300 shadow-[0_0_8px_hsl(var(--emerald-400)/0.6)]"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  );
}
