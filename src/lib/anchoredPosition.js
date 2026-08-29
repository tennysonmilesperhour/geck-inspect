/**
 * Geometry for anchoring a floating panel (a dropdown, popover, or settings
 * panel) to the trigger button that opens it.
 *
 * Kept as a pure function, separate from the React hook that uses it, so the
 * clamping rules can be tested without a DOM.
 */

/** Minimum gap to keep between a panel and the edge of the viewport. */
export const ANCHOR_MARGIN = 8;

/**
 * Work out where a fixed-position panel should sit relative to its anchor.
 *
 * The panel is right-aligned with its anchor when there is room, which is the
 * usual look for a dropdown. That alignment on its own is not safe: when the
 * anchor sits near the left edge of the screen (common on mobile, where a
 * toolbar button is the first item in a full-width row) right-aligning pushes
 * the panel off the left side of the screen. So the result is clamped into the
 * viewport on both axes, and the panel flips above the anchor when there is
 * not enough room below it.
 *
 * The panel stays on screen even when its anchor does not. Scrolling an open
 * panel's trigger out of view pins the panel to the nearest viewport edge
 * rather than letting it slide away with the trigger.
 *
 * @param {object} args
 * @param {{top: number, bottom: number, right: number}} args.anchor  Anchor rect, viewport-relative
 * @param {{width: number, height: number}} args.panel  Measured panel size
 * @param {{width: number, height: number}} args.viewport  Visible viewport size
 * @param {number} [args.margin]  Minimum gap to the viewport edge
 * @returns {{top: number, left: number, maxWidth: number, maxHeight: number}}
 */
export function computeAnchoredPosition({ anchor, panel, viewport, margin = ANCHOR_MARGIN }) {
    const { width: vw, height: vh } = viewport;
    const { width: panelW, height: panelH } = panel;

    // Right-align with the anchor, then clamp so neither edge escapes.
    let left = Math.min(anchor.right - panelW, vw - panelW - margin);
    left = Math.max(margin, left);

    // Prefer opening below the anchor, flipping above when the panel would
    // otherwise run past the bottom of the viewport.
    let top = anchor.bottom + margin;
    if (top + panelH > vh - margin) {
        const above = anchor.top - margin - panelH;
        top = above >= margin ? above : vh - margin - panelH;
    }
    // Pin into the viewport. Without this the panel rides off the top or
    // bottom of the screen once its anchor scrolls out of view.
    top = Math.max(margin, Math.min(top, vh - margin - panelH));

    return { top, left, maxWidth: vw - margin * 2, maxHeight: vh - margin * 2 };
}
