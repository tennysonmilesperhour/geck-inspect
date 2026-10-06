import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { getMorph, RARITY } from '@/data/morph-guide';
import { captureEvent } from '@/lib/posthog';
import IllustratedGecko, { hasIllustration } from '@/components/morphguide/IllustratedGecko';

/**
 * Photo lookup for morph thumbnails: slug in, image URL (or null) out.
 * MorphDetail fills it from the same `morph_guides` rows it already loads
 * for the hero, so previews and comparison tiles use the same photos as
 * the morph pages themselves. With no provider every thumbnail shows the
 * styled initials.
 */
export const MorphImageContext = createContext(() => null);

export function useMorphImage(slug) {
  return useContext(MorphImageContext)(slug);
}

// Color wash per category for the no-photo fallback.
export const CATEGORY_FALLBACK_TONE = {
  base: 'from-orange-500/30 via-amber-500/10',
  color: 'from-violet-500/30 via-fuchsia-500/10',
  pattern: 'from-emerald-500/30 via-teal-500/10',
  structure: 'from-sky-500/30 via-cyan-500/10',
  combo: 'from-amber-500/30 via-rose-500/10',
};

export function morphInitials(name) {
  return String(name || '')
    .replace(/\(.*?\)/g, '')
    .split(/[\s/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

/**
 * A morph photo that fills its box, or, with no photo (or a broken one),
 * the category color wash with the morph's initials. The parent sets the
 * size (an aspect ratio box works well).
 */
export function MorphThumb({ slug, name, src: srcProp, className = '', textClass = 'text-3xl' }) {
  const morph = getMorph(slug);
  const looked = useMorphImage(slug);
  const src = srcProp === undefined ? looked : srcProp;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const label = name || morph?.name || slug;
  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${
        CATEGORY_FALLBACK_TONE[morph?.category] || 'from-emerald-500/30 via-teal-500/10'
      } to-neutral-950 ${className}`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:14px_14px]"
      />
      {hasIllustration(morph?.slug) ? (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center p-2">
          <IllustratedGecko morph={morph.slug} decorative className="w-full h-auto max-h-full" />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={`absolute inset-0 flex items-center justify-center font-bold tracking-tight text-white/75 ${textClass}`}
        >
          {morphInitials(label)}
        </span>
      )}
      {src && !failed && (
        <img
          src={src}
          alt={`${label} crested gecko`}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

const CARD_WIDTH = 288;
const GAP = 8;
const EDGE = 8;
const HOVER_DELAY = 200;
const CLOSE_DELAY = 150;
// Only one preview is open at a time; opening one tells the others.
const OPEN_EVENT = 'morph-preview:open';

/**
 * Where the card goes: below the link when it fits, otherwise above, and
 * never on top of the link itself (so a finger can always tap it again).
 * Horizontally it is centred on the link and kept inside the screen.
 */
export function previewPosition(anchor, card, viewport) {
  const width = Math.min(card.width, viewport.width - EDGE * 2);
  const below = viewport.height - anchor.bottom;
  const above = anchor.top;
  const needed = card.height + GAP + EDGE;
  const placeBelow = below >= needed || (above < needed && below >= above);
  const top = placeBelow ? anchor.bottom + GAP : anchor.top - GAP - card.height;
  const centred = anchor.left + anchor.width / 2 - width / 2;
  const left = Math.max(EDGE, Math.min(centred, viewport.width - width - EDGE));
  return { top, left, width, side: placeBelow ? 'below' : 'above' };
}

/**
 * A link to another morph's page that previews it: a short hover on a
 * computer, the first tap on a phone (the second tap opens the page), or
 * keyboard focus. Escape or a tap elsewhere closes it.
 */
export function MorphPreviewLink({ slug, from, children, className = '' }) {
  const morph = getMorph(slug);
  const navigate = useNavigate();
  const id = useId();
  const cardId = `morph-preview-${id.replace(/:/g, '')}`;
  const linkRef = useRef(null);
  const cardRef = useRef(null);
  const openTimer = useRef(0);
  const closeTimer = useRef(0);
  const pointerType = useRef('mouse');
  const [open, setOpen] = useState(false);
  const [viaTouch, setViaTouch] = useState(false);
  const [pos, setPos] = useState(null);
  const to = `/MorphGuide/${slug}`;

  const clearTimers = () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  };

  const show = useCallback(
    (touch = false) => {
      clearTimers();
      setViaTouch(touch);
      setOpen((was) => {
        if (!was) {
          captureEvent('morph_guide_preview_opened', { from, to: slug });
          window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: cardId }));
        }
        return true;
      });
    },
    [from, slug, cardId],
  );

  const hide = useCallback(() => {
    clearTimers();
    setOpen(false);
    setPos(null);
  }, []);

  const hideSoon = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(hide, CLOSE_DELAY);
  };

  useEffect(() => () => clearTimers(), []);

  // Place the card once it has rendered and can be measured.
  useLayoutEffect(() => {
    if (!open || !linkRef.current || !cardRef.current) return;
    const a = linkRef.current.getBoundingClientRect();
    const c = cardRef.current.getBoundingClientRect();
    setPos(
      previewPosition(
        { top: a.top, bottom: a.bottom, left: a.left, width: a.width },
        { width: CARD_WIDTH, height: c.height },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
  }, [open]);

  // While open: Escape, a tap elsewhere, scrolling or another preview
  // opening all close it.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        hide();
        linkRef.current?.focus();
      }
    };
    const onDown = (e) => {
      if (linkRef.current?.contains(e.target) || cardRef.current?.contains(e.target)) return;
      hide();
    };
    const onOther = (e) => {
      if (e.detail !== cardId) hide();
    };
    const onScroll = () => hide();
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener(OPEN_EVENT, onOther);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
      window.removeEventListener(OPEN_EVENT, onOther);
    };
  }, [open, hide, cardId]);

  if (!morph) return <>{children}</>;
  const rarity = RARITY[morph.rarity];

  const card =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={cardRef}
            id={cardId}
            role="tooltip"
            onPointerEnter={(e) => e.pointerType === 'mouse' && window.clearTimeout(closeTimer.current)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && hideSoon()}
            style={
              pos
                ? { top: pos.top, left: pos.left, width: pos.width }
                : { top: 0, left: -9999, width: CARD_WIDTH, visibility: 'hidden' }
            }
            className={`fixed z-50 overflow-hidden rounded-xl border border-neutral-700/80 bg-neutral-900 text-left shadow-2xl shadow-black/60 ring-1 ring-black/40 ${
              pos ? `motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-150 ${pos.side === 'below' ? 'motion-safe:slide-in-from-top-1' : 'motion-safe:slide-in-from-bottom-1'}` : ''
            }`}
          >
            <Link
              to={to}
              tabIndex={-1}
              onClick={() => {
                captureEvent('morph_guide_cta_clicked', { slug: from, target: to, placement: 'preview_card' });
                hide();
              }}
              className="block group"
            >
              <MorphThumb slug={slug} name={morph.name} className="h-28 w-full" textClass="text-4xl" />
              <div className="p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white leading-tight">{morph.name}</span>
                  {rarity && (
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${rarity.color}`}>
                      {rarity.label}
                    </span>
                  )}
                </div>
                {(morph.definition || morph.summary) && (
                  <p className="mt-1.5 text-[13px] leading-snug text-neutral-300 line-clamp-4">
                    {morph.definition || morph.summary}
                  </p>
                )}
                <span className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-300 group-hover:text-emerald-200">
                  {viaTouch ? `Tap again to open the ${morph.name} guide` : `Open the ${morph.name} guide`}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </div>
            </Link>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <Link
        ref={linkRef}
        to={to}
        aria-describedby={open ? cardId : undefined}
        className={className}
        onPointerDown={(e) => {
          pointerType.current = e.pointerType;
        }}
        onPointerEnter={(e) => {
          if (e.pointerType !== 'mouse') return;
          window.clearTimeout(closeTimer.current);
          if (open) return;
          openTimer.current = window.setTimeout(() => show(false), HOVER_DELAY);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'mouse') return;
          window.clearTimeout(openTimer.current);
          if (open) hideSoon();
        }}
        onFocus={(e) => {
          let keyboard = true;
          try {
            keyboard = e.currentTarget.matches(':focus-visible');
          } catch {
            /* older browsers: treat focus as keyboard focus */
          }
          if (keyboard) show(false);
        }}
        onBlur={(e) => {
          if (cardRef.current?.contains(e.relatedTarget)) return;
          hideSoon();
        }}
        onClick={(e) => {
          // e.detail is 0 for a click made with the keyboard (Enter), which
          // should always open the page.
          const touch =
            e.detail !== 0 && (pointerType.current === 'touch' || pointerType.current === 'pen');
          pointerType.current = 'mouse';
          if (touch && !open) {
            e.preventDefault();
            show(true);
            return;
          }
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          captureEvent('morph_guide_cta_clicked', { slug: from, target: to, placement: 'inline_link' });
          hide();
          navigate(to);
        }}
      >
        {children}
      </Link>
      {card}
    </>
  );
}
