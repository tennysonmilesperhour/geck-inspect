import { useEffect, useRef, useState } from 'react';

/**
 * Shows its children once this spot on the page comes within `margin` of
 * the screen, and not before. Sections far down a long page (the Morph
 * Guide's Field Notebook and eye guide) then download only for visitors
 * who scroll toward them. Without IntersectionObserver (server render,
 * tests, old browsers) the children show at once.
 */
export default function NearScreen({ children, margin = '800px 0px' }) {
  const ref = useRef(null);
  const [near, setNear] = useState(
    () => typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function',
  );

  useEffect(() => {
    if (near || !ref.current) return undefined;
    const observer = new window.IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNear(true);
        observer.disconnect();
      }
    }, { rootMargin: margin });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [near, margin]);

  if (near) return children;
  return <div ref={ref} aria-hidden="true" />;
}
