import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Sparkles, ArrowRightLeft, MessageSquare } from 'lucide-react';
import {
    FALLBACK_NAV_ITEMS,
    flattenNavItems,
    groupNavItems,
    KEEPER_MODE_STORAGE_KEY,
    BREEDER_ONLY_PAGES,
} from '@/lib/navItems';

/**
 * Tutorial walkthrough, anchored tooltip tour.
 *
 * Instead of a slideshow popup, this version walks the user through
 * each visible tab in the sidebar one at a time. At each step it:
 *
 *   1. Looks up the DOM node for that tab via a data-tutorial-id
 *      attribute that Layout.jsx writes onto every rendered nav link.
 *   2. Scrolls the anchor into view, highlights it with a pulsing ring,
 *      and pops a compact tooltip bubble next to it explaining what
 *      that section is for.
 *   3. Tabs that aren't rendered (page config disabled, auth required
 *      but user is signed out, etc.) are silently skipped, no
 *      references to features the user can't access.
 *
 * The step content is keyed by the nav item's `page_name` so the
 * sidebar and the tutorial stay in sync without a duplicate hardcoded
 * step list.
 */

import { STEP_BLURBS } from '@/data/tutorial-steps';

const TOOLTIP_WIDTH = 360;

// The tutorial card is pinned to a consistent spot in the viewport so
// the Next/Back buttons don't chase the user's cursor around as the
// highlight ring jumps between sidebar items. On wide screens we pin
// it to the bottom-right; on narrow screens it becomes a centered
// bottom sheet.
function getPinnedCardStyle() {
    if (typeof window === 'undefined') {
        return { bottom: 24, right: 24, width: TOOLTIP_WIDTH };
    }
    const viewportWidth = window.innerWidth;
    if (viewportWidth < TOOLTIP_WIDTH + 64) {
        return {
            bottom: 16,
            left: 16,
            right: 16,
        };
    }
    return {
        bottom: 24,
        right: 24,
        width: TOOLTIP_WIDTH,
    };
}

export default function TutorialModal({ isOpen, onClose }) {
    const [steps, setSteps] = useState([]);
    const [stepIndex, setStepIndex] = useState(0);
    const [anchorRect, setAnchorRect] = useState(null);
    const [migrationMode, setMigrationMode] = useState(false);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (!isOpen) setMigrationMode(false);
    }, [isOpen]);

    // Build the step list from the static nav data, in sidebar group
    // order. Each step carries its group id (as sectionId) so a folded
    // group can be opened before the step points into it.
    //
    // Anchors are looked up live at render-time in the layout effect
    // below, since unfolding a group mounts its tiles a moment later.
    useEffect(() => {
        if (!isOpen) return;

        let flat = flattenNavItems(FALLBACK_NAV_ITEMS);
        // In Keeper mode, drop the breeder/business tiles so a pet keeper's
        // tour matches their (decluttered) sidebar instead of walking them
        // through breeding and selling tools they turned off.
        try {
            if (typeof localStorage !== 'undefined'
                && localStorage.getItem(KEEPER_MODE_STORAGE_KEY) === '1') {
                flat = flat.filter((item) => !BREEDER_ONLY_PAGES.has(item.page_name));
            }
        } catch {
            // localStorage unavailable; fall back to the full tour
        }
        // Same groups, same order as the sidebar.
        const groups = groupNavItems(flat);

        const welcomeStep = {
            pageName: '__welcome',
            label: 'Welcome',
            sectionId: null,
            blurb: {
                title: 'Welcome to Geck Inspect',
                body: 'Everything lives in the sidebar, in five groups: Collection, Breeding, Tools, Learn and Community. We\'ll walk through them one tile at a time. Use the arrows, or hit Esc to skip.',
            },
        };
        const doneStep = {
            pageName: '__done',
            label: 'All set',
            sectionId: null,
            blurb: {
                title: "You're all set",
                body: 'Pick favorites from any tile to pin them to the top of the sidebar. Customize the theme + accent color in Settings. Need a hand or want a feature? The feedback tab on the right edge of the screen reaches us directly. Relaunch this tour anytime from the command palette (⌘K).',
            },
        };

        // For each sidebar group, an overview step anchored to the group
        // heading, then one step per tile inside it.
        const sectionSteps = groups.flatMap((group) => {
            const headerKey = `__group_${group.id}`;
            const header = {
                pageName: headerKey,
                label: group.label,
                sectionId: group.id,
                blurb: STEP_BLURBS[headerKey] || { title: group.label, body: `The ${group.label} group.` },
            };
            const items = group.items.filter((item) => STEP_BLURBS[item.page_name]).map((item) => ({
                pageName: item.page_name,
                label: item.display_name,
                sectionId: group.id,
                blurb: STEP_BLURBS[item.page_name],
            }));
            return [header, ...items];
        });

        setSteps([welcomeStep, ...sectionSteps, doneStep]);
        setStepIndex(0);
    }, [isOpen]);

    const currentStep = steps[stepIndex] || null;

    // Pick the visible anchor for a given page_name. Both desktop and
    // mobile sidebars can be in the DOM at once (Layout renders a
    // shared mobile Sidebar plus a desktop favorites grid), so prefer
    // the node that's actually painting (offsetParent !== null).
    const findAnchorNode = (pageName) => {
        const nodes = document.querySelectorAll(`[data-tutorial-id="${pageName}"]`);
        let firstHidden = null;
        for (const n of nodes) {
            if (n.offsetParent !== null) return n;
            if (!firstHidden) firstHidden = n;
        }
        return firstHidden;
    };

    // A member may have folded the group this step points into. Ask
    // Layout to unfold it so the tile is on screen.
    const ensureSection = (groupId) => {
        if (!groupId) return false;
        window.dispatchEvent(new CustomEvent('open_nav_group', { detail: groupId }));
        return true;
    };

    // Track the anchor rect so the tooltip follows the element on
    // scroll/resize. Resolves the node live (rather than caching it on
    // the step) so section switches that re-mount the sidebar still
    // land the highlight ring on the right tile. We retry a few times
    // because `tab.click()` triggers async navigation + render.
    useLayoutEffect(() => {
        if (!currentStep) {
            setAnchorRect(null);
            return;
        }

        // Synthetic intro/outro steps have no anchor, center card.
        if (currentStep.pageName === '__welcome' || currentStep.pageName === '__done') {
            setAnchorRect(null);
            return;
        }

        // Unfold the step's sidebar group if the member folded it.
        if (currentStep.sectionId) ensureSection(currentStep.sectionId);

        let cancelled = false;
        let resolvedNode = null;

        const measure = (node) => {
            const r = node.getBoundingClientRect();
            setAnchorRect({
                top: r.top,
                left: r.left,
                right: r.right,
                bottom: r.bottom,
                width: r.width,
                height: r.height,
            });
        };

        // Try to resolve the anchor up to ~600ms after step change so
        // a section switch has time to mount the new sidebar items.
        const attempts = [0, 80, 180, 320, 600];
        const timers = attempts.map((delay) =>
            setTimeout(() => {
                if (cancelled) return;
                const node = findAnchorNode(currentStep.pageName);
                if (!node) return;
                resolvedNode = node;
                node.scrollIntoView({ behavior: 'smooth', block: 'center' });
                measure(node);
            }, delay),
        );

        const update = () => {
            if (cancelled) return;
            const node = resolvedNode || findAnchorNode(currentStep.pageName);
            if (!node) return;
            resolvedNode = node;
            measure(node);
        };

        window.addEventListener('scroll', update, { passive: true, capture: true });
        window.addEventListener('resize', update);
        intervalRef.current = setInterval(update, 500);
        return () => {
            cancelled = true;
            timers.forEach(clearTimeout);
            window.removeEventListener('scroll', update, { capture: true });
            window.removeEventListener('resize', update);
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
         
    }, [currentStep?.pageName, currentStep?.sectionId]);

    // Close on Esc
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => {
            if (e.key === 'Escape') handleFinish();
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
         
    }, [isOpen, stepIndex, steps.length]);

    const handleFinish = () => {
        localStorage.setItem('tutorial_completed', 'true');
        setStepIndex(0);
        setAnchorRect(null);
        onClose();
    };

    const handleNext = () => {
        setStepIndex((s) => Math.min(s + 1, steps.length - 1));
    };

    const handlePrev = () => {
        setStepIndex((s) => Math.max(s - 1, 0));
    };

    const [pinnedStyle, setPinnedStyle] = useState(() => getPinnedCardStyle());
    useEffect(() => {
        const update = () => setPinnedStyle(getPinnedCardStyle());
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    if (!isOpen || !currentStep) return null;

    const isLast = stepIndex === steps.length - 1;
    const isIntro = currentStep.pageName === '__welcome';
    const isOutro = currentStep.pageName === '__done';
    const blurb = currentStep.blurb;

    const dimmer = (
        <div
            onClick={handleFinish}
            className="fixed inset-0 z-[9998] bg-black/55 backdrop-blur-[2px]"
            style={{
                // Cut a hole around the anchor using a radial gradient,
                // so the highlighted tab "pops out" of the dimmer.
                ...(anchorRect && {
                    WebkitMaskImage: `radial-gradient(ellipse ${anchorRect.width + 24}px ${anchorRect.height + 16}px at ${anchorRect.left + anchorRect.width / 2}px ${anchorRect.top + anchorRect.height / 2}px, transparent 60%, black 100%)`,
                    maskImage: `radial-gradient(ellipse ${anchorRect.width + 24}px ${anchorRect.height + 16}px at ${anchorRect.left + anchorRect.width / 2}px ${anchorRect.top + anchorRect.height / 2}px, transparent 60%, black 100%)`,
                }),
            }}
        />
    );

    const highlightRing = anchorRect && !isIntro && !isOutro ? (
        <div
            className="fixed z-[9999] pointer-events-none rounded-lg"
            style={{
                top: anchorRect.top - 4,
                left: anchorRect.left - 4,
                width: anchorRect.width + 8,
                height: anchorRect.height + 8,
                boxShadow:
                    '0 0 0 2px rgb(16, 185, 129), 0 0 0 6px rgba(16, 185, 129, 0.25), 0 0 28px 10px rgba(16, 185, 129, 0.3)',
                animation: 'geck-pulse 1.6s ease-in-out infinite',
            }}
        />
    ) : null;

    // Intro/outro get a centered card. Every anchored step uses the
    // same pinned position so Next/Back don't move around under the
    // cursor while the highlight ring jumps between sidebar items.
    const anchoredStyle =
        isIntro || isOutro
            ? {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                // Never wider than a phone screen, or the close button
                // lands off the right edge.
                width: 'min(440px, calc(100vw - 2rem))',
              }
            : pinnedStyle;

    const card = (
        <div
            className="fixed z-[10000] rounded-2xl border border-emerald-500/30 bg-slate-900/95 backdrop-blur-md shadow-2xl p-5 text-slate-100"
            style={anchoredStyle}
        >
            {/* Progress bar */}
            <div className="absolute left-0 right-0 top-0 h-1 bg-slate-800 rounded-t-2xl overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-300"
                    style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
                />
            </div>

            <button
                onClick={handleFinish}
                className="absolute top-2 right-2 touch-hit text-slate-500 hover:text-slate-200 rounded-full p-1"
                aria-label="Close tutorial"
            >
                <X className="w-4 h-4" />
            </button>

            <div className="mt-2">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                    <Sparkles className="w-3 h-3" />
                    Step {stepIndex + 1} of {steps.length}
                </div>
                {isIntro && migrationMode ? (
                    <>
                        <h2 className="text-lg font-bold mt-2">Migrating an existing collection</h2>
                        <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                            Bringing records over from another tracker (spreadsheet, iHerp, Morphmarket notes,
                            a different app) is a first-class workflow. The tour below will call out the
                            pages where migrated data lands, My Geckos, Breeding, Lineage, and My Profile,
                            and the import points in each.
                        </p>
                        <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                            If you want a hand getting everything across cleanly, reach out and I&apos;ll
                            help directly. I can also build new import/export features to fit the format
                            your old data is in, just ask.
                        </p>
                        <div className="mt-3 flex flex-col gap-2">
                            <a
                                href="/Contact"
                                className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 text-xs font-medium px-3 py-2 touch:min-h-11"
                            >
                                <MessageSquare className="w-3.5 h-3.5" />
                                Contact me about a migration
                            </a>
                            <button
                                onClick={() => setMigrationMode(false)}
                                className="text-xs touch:min-h-11 text-slate-400 hover:text-slate-200 self-start"
                            >
                                Back to welcome
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <h2 className="text-lg font-bold mt-2">{blurb.title}</h2>
                        <p className="text-sm text-slate-300 mt-1 leading-relaxed">{blurb.body}</p>
                        {isIntro && (
                            <button
                                onClick={() => setMigrationMode(true)}
                                className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-800/70 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-2 touch:min-h-11"
                            >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                I&apos;m migrating an existing collection
                            </button>
                        )}
                    </>
                )}
            </div>

            <div className="flex items-center justify-between mt-4 gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    onClick={handlePrev}
                    disabled={stepIndex === 0}
                    className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40"
                >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                </Button>
                <button
                    onClick={handleFinish}
                    className="text-xs touch:min-h-11 text-slate-500 hover:text-slate-300"
                >
                    Skip tour
                </button>
                {isLast ? (
                    <Button
                        size="sm"
                        onClick={handleFinish}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                        Finish
                    </Button>
                ) : (
                    <Button
                        size="sm"
                        onClick={handleNext}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                        Next
                        <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                )}
            </div>
        </div>
    );

    return createPortal(
        <>
            {dimmer}
            {highlightRing}
            {card}
            <style>{`
                @keyframes geck-pulse {
                    0%, 100% { opacity: 0.85; }
                    50% { opacity: 0.35; }
                }
            `}</style>
        </>,
        document.body
    );
}
