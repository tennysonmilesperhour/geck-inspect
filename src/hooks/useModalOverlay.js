import { useEffect, useRef } from 'react';

/**
 * Accessibility for the full-screen overlays the app builds by hand (a
 * fixed, full-screen div rather than the shared Radix Dialog).
 *
 * Spread the returned props on the overlay's outer element:
 *
 *   const overlay = useModalOverlay(onClose);
 *   <div {...overlay} aria-label="Weigh-in mode" className="fixed inset-0 ...">
 *
 * What it adds, and why:
 * - role="dialog" and aria-modal="true", so screen readers announce a
 *   dialog and treat the page behind it as unavailable.
 * - data-state="open", which together with the role is what the rule in
 *   src/index.css looks for to hide the feedback tab, the guest notice and
 *   feeding alerts. Without it those floating widgets sat on top of the
 *   overlay's Cancel and Save buttons (Weigh-in mode on a phone).
 * - Escape closes the overlay, like every Radix dialog in the app.
 * - Keyboard focus moves into the overlay when it opens (unless a field in
 *   it already took focus) and goes back where it was when it closes.
 *
 * Render the element only while the overlay is open. A component that
 * stays mounted while closed (it returns null instead) passes its open
 * flag as the second argument, so the hook sets up again on each opening.
 */

// Layers that sit above a hand-built overlay and should get Escape first:
// another open dialog, or a Radix popover, menu or select list.
const LAYER_SELECTOR = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[data-radix-popper-content-wrapper]',
].join(', ');

// Node.DOCUMENT_POSITION_FOLLOWING, spelled out so tests can run without
// a browser.
const FOLLOWING = 4;

/**
 * Should this overlay close for this keydown? Only for Escape, only if
 * nothing handled the key already (a Radix layer that closes on Escape
 * marks the event handled), and only if no other dialog or popover comes
 * after this overlay in the page. Later elements are drawn on top, so the
 * overlay the person is looking at is the one that closes.
 */
export function shouldCloseOnEscape(event, node, doc = typeof document !== 'undefined' ? document : null) {
  if (!event || event.key !== 'Escape' || event.defaultPrevented) return false;
  if (!node || !doc) return false;
  const layers = Array.from(doc.querySelectorAll(LAYER_SELECTOR));
  return !layers.some((el) => el !== node && (node.compareDocumentPosition(el) & FOLLOWING));
}

export default function useModalOverlay(onClose, open = true) {
  const ref = useRef(null);
  // Always call the latest onClose without re-adding the key listener on
  // every render (callers usually pass a new arrow function each time).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const node = ref.current;
    if (!open || !node || typeof document === 'undefined') return undefined;

    // Focus: bring the keyboard into the overlay, and back out on close.
    const previous = document.activeElement;
    if (!node.contains(document.activeElement)) {
      try {
        node.focus({ preventScroll: true });
      } catch {
        // an element that cannot take focus is not worth failing over
      }
    }

    const onKeyDown = (event) => {
      // ref.current, not node: a component that swaps its overlay markup
      // (a loading state, then a form) moves the ref to the new element.
      if (!onCloseRef.current || !shouldCloseOnEscape(event, ref.current)) return;
      // Mark it handled so an overlay underneath does not close as well.
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
        try {
          previous.focus({ preventScroll: true });
        } catch {
          // the old element went away; nothing to return to
        }
      }
    };
  }, [open]);

  return {
    ref,
    role: 'dialog',
    'aria-modal': 'true',
    'data-state': 'open',
    // Marks the element for the focus-outline rule in src/index.css.
    'data-modal-overlay': '',
    // Lets the overlay itself take focus without joining the Tab order.
    tabIndex: -1,
  };
}
