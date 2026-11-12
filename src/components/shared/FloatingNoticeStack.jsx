import { useEffect, useRef } from 'react';

/**
 * The bottom-right corner for the floating notices the app shell mounts
 * (the guest demo tour or notice, and the phone notification ask beside a
 * due feeding). Its height is published as --floating-notices-h so the
 * page can scroll its last content clear of whatever is showing (see
 * .app-main-scroll in Layout).
 *
 * Which notice shows is not decided here. Every floating notice in the
 * app, these two and the three App.jsx mounts (update, consent, offline),
 * takes its turn in one queue, floatingNoticeQueue.js, so this holds one
 * notice at most.
 */
export default function FloatingNoticeStack({ children }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const root = document.documentElement;
    const publish = () => {
      const h = el.offsetHeight;
      root.style.setProperty('--floating-notices-h', h > 0 ? `${h + 12}px` : '0px');
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.setProperty('--floating-notices-h', '0px');
    };
  }, []);

  return (
    <div
      ref={ref}
      data-floating-stack
      data-follows-bottom-bar
      className="fixed bottom-[calc(var(--bottom-bar-h)+1rem)] md:bottom-4 right-4 z-[60] flex flex-col items-end gap-2 pointer-events-none [&>*]:pointer-events-auto"
    >
      {children}
    </div>
  );
}
