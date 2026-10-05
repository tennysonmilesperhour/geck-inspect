import { useEffect, useRef } from 'react';

/**
 * One bottom-right corner for the app's floating notices (the guest demo
 * tour or notice, feeding reminders). Each used to position itself in the
 * same spot, so on a phone they sat on top of each other. Here they stack
 * in a column, newest-to-the-bottom, and the stack's height is published
 * as --floating-notices-h so the page can scroll its last content clear
 * of them (see .app-main-scroll in Layout).
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
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4 right-4 z-[60] flex flex-col items-end gap-2 pointer-events-none [&>*]:pointer-events-auto"
    >
      {children}
    </div>
  );
}
