import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { computeAnchoredPosition, ANCHOR_MARGIN } from '@/lib/anchoredPosition';

/**
 * Positions a fixed-position floating panel against an anchor element, keeping
 * the panel inside the visible viewport.
 *
 * See computeAnchoredPosition for the placement rules. This hook handles the
 * measuring: it reads the anchor and panel on open, and repositions on resize
 * and on scroll so a fixed panel never drifts away from its trigger.
 *
 * @param {boolean} open  Whether the panel is currently rendered
 * @param {number} margin  Minimum gap to keep between the panel and the viewport edge
 * @returns {{anchorRef: object, panelRef: object, style: object}}
 *   Refs to attach to the trigger and the panel, plus the style to spread onto
 *   the panel element.
 */
export default function useAnchoredPosition(open, margin = ANCHOR_MARGIN) {
    const anchorRef = useRef(null);
    const panelRef = useRef(null);
    const [pos, setPos] = useState(null);

    const updatePosition = useCallback(() => {
        const anchor = anchorRef.current;
        const panel = panelRef.current;
        if (!anchor || !panel) return;

        const rect = anchor.getBoundingClientRect();
        setPos(computeAnchoredPosition({
            anchor: rect,
            panel: { width: panel.offsetWidth, height: panel.offsetHeight },
            // clientWidth/clientHeight exclude any classic desktop scrollbar,
            // so the panel is never tucked underneath it.
            viewport: {
                width: document.documentElement.clientWidth,
                height: document.documentElement.clientHeight,
            },
            margin,
        }));
    }, [margin]);

    useLayoutEffect(() => {
        if (!open) {
            setPos(null);
            return;
        }
        updatePosition();
    }, [open, updatePosition]);

    useEffect(() => {
        if (!open) return undefined;
        const handle = () => updatePosition();
        window.addEventListener('resize', handle);
        // Capture phase, so scrolling any ancestor container repositions too.
        window.addEventListener('scroll', handle, true);
        return () => {
            window.removeEventListener('resize', handle);
            window.removeEventListener('scroll', handle, true);
        };
    }, [open, updatePosition]);

    // CSS cap for the first, not-yet-measured paint. Once measured, the exact
    // pixel cap from computeAnchoredPosition takes over.
    const cssMaxWidth = `calc(100vw - ${margin * 2}px)`;
    const style = pos
        ? { position: 'fixed', top: pos.top, left: pos.left, maxWidth: pos.maxWidth, maxHeight: pos.maxHeight, overflowY: 'auto' }
        // First paint: rendered but hidden so it can be measured, rather than
        // flashing at the wrong spot before its size is known.
        : { position: 'fixed', top: 0, left: 0, maxWidth: cssMaxWidth, visibility: 'hidden' };

    return { anchorRef, panelRef, style };
}
