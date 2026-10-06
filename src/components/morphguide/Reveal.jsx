import { useEffect, useRef, useState } from 'react';

/**
 * Fades and lifts its content in the first time it scrolls into view.
 *
 * Content that is already on screen when the page loads is never hidden,
 * so the answer at the top of the page does not flicker. People who ask
 * their device for reduced motion get no animation at all (the
 * motion-safe: classes only apply when that setting is off).
 */
export default function Reveal({ as: Tag = 'div', className = '', children, ...rest }) {
  const ref = useRef(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) return undefined;
    setHidden(true);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setHidden(false);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`motion-safe:transition-[opacity,transform] motion-safe:duration-700 motion-safe:ease-out ${
        hidden ? 'motion-safe:opacity-0 motion-safe:translate-y-4' : 'opacity-100 translate-y-0'
      } ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
