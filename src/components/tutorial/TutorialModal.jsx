import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';

/**
 * Tutorial walkthrough — anchored tooltip tour.
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
 *      but user is signed out, etc.) are silently skipped — no
 *      references to features the user can't access.
 *
 * The step content is keyed by the nav item's `page_name` so the
 * sidebar and the tutorial stay in sync without a duplicate hardcoded
 * step list.
 */

// Blurbs keyed by page_name. Any nav item not listed here gets a
// generic fallback blurb ("Open <Display Name> to...").
const STEP_BLURBS = {
    Dashboard: {
        title: 'Dashboard',
        body: 'Your home base. Personal to-do list, gecko of the day, community pulse, featured breeders, and quick stats.',
    },
    MyGeckos: {
        title: 'My Geckos',
        body: 'Your full collection. Add geckos, track weight, status, morph tags, and jump into individual profiles.',
    },
    Breeding: {
        title: 'Breeding',
        body: 'Create breeding pairs, log copulation events, track eggs through incubation, and auto-hatch them into new geckos.',
    },
    Lineage: {
        title: 'Lineage',
        body: 'Visualize multi-generation family trees. Add placeholder ancestors for geckos purchased from other breeders.',
    },
    MyProfile: {
        title: 'My Profile',
        body: 'Your public-facing page. Shows your bio, geckos for sale, breeding projects, and social links.',
    },
    MarketplaceSalesStats: {
        title: 'Sales Stats',
        body: 'Year-over-year revenue, cost tracking, best-selling morphs, and profit trends.',
    },
    OtherReptiles: {
        title: 'Other Reptiles',
        body: 'Track non-gecko reptiles you keep — leopard geckos, ball pythons, blue tongue skinks, etc.',
    },
    Recognition: {
        title: 'Morph ID',
        body: 'Upload a photo and our AI will identify the gecko\'s morphs and traits.',
    },
    MorphVisualizer: {
        title: 'Morph Visualizer',
        body: 'Preview how different morph combinations look on a stylized gecko — great for project planning.',
    },
    BreederConsultant: {
        title: 'AI Consultant',
        body: 'Ask any question about crested gecko care, breeding, genetics, or pricing. Real gecko knowledge, no guessing.',
    },
    ProjectManager: {
        title: 'Season Planner',
        body: 'Plan your breeding season, manage feeding groups, schedule tasks, and set up future breeding plans.',
    },
    GeneticsGuide: {
        title: 'Genetics Guide',
        body: 'A hands-on crested gecko genetics primer — dominant, co-dominant, recessive, and polygenic traits explained.',
    },
    Training: {
        title: 'Train Model',
        body: 'Help the AI improve by labeling gecko photos. Earn badges as you contribute to the training dataset.',
    },
    Dashboard_default: {
        title: 'Dashboard',
        body: 'Your home base.',
    },
};

const TOOLTIP_WIDTH = 320;
const TOOLTIP_GAP = 16;

// Compute where the tooltip should sit next to the anchor rect.
function computeTooltipPlacement(anchorRect) {
    if (!anchorRect) {
        return {
            style: { top: 20, left: 20 },
            arrowSide: null,
        };
    }
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const spaceRight = viewportWidth - anchorRect.right;
    const spaceLeft = anchorRect.left;

    // Prefer placing to the right of the sidebar item. If there isn't
    // room, fall back to the left; if the anchor is mobile-centered,
    // place below.
    if (spaceRight >= TOOLTIP_WIDTH + TOOLTIP_GAP) {
        return {
            style: {
                top: Math.max(16, anchorRect.top + anchorRect.height / 2 - 60),
                left: anchorRect.right + TOOLTIP_GAP,
                width: TOOLTIP_WIDTH,
            },
            arrowSide: 'left',
        };
    }
    if (spaceLeft >= TOOLTIP_WIDTH + TOOLTIP_GAP) {
        return {
            style: {
                top: Math.max(16, anchorRect.top + anchorRect.height / 2 - 60),
                left: anchorRect.left - TOOLTIP_WIDTH - TOOLTIP_GAP,
                width: TOOLTIP_WIDTH,
            },
            arrowSide: 'right',
        };
    }
    // Fallback: below the anchor
    return {
        style: {
            top: Math.min(viewportHeight - 200, anchorRect.bottom + TOOLTIP_GAP),
            left: Math.max(
                16,
                Math.min(
                    viewportWidth - TOOLTIP_WIDTH - 16,
                    anchorRect.left + anchorRect.width / 2 - TOOLTIP_WIDTH / 2
                )
            ),
            width: TOOLTIP_WIDTH,
        },
        arrowSide: 'top',
    };
}

export default function TutorialModal({ isOpen, onClose }) {
    const [steps, setSteps] = useState([]);
    const [stepIndex, setStepIndex] = useState(0);
    const [anchorRect, setAnchorRect] = useState(null);
    const intervalRef = useRef(null);

    // Collect the list of actually-rendered nav items when the tutorial
    // opens. Everything that has a `data-tutorial-id` attribute is a
    // live anchor; disabled pages don't have one so they're skipped.
    // Prefer visible nodes (offsetParent !== null) so we highlight the
    // right copy when both mobile + desktop sidebars are in the DOM.
    useEffect(() => {
        if (!isOpen) return;
        const nodes = Array.from(document.querySelectorAll('[data-tutorial-id]'));
        const byId = new Map();
        for (const node of nodes) {
            const id = node.getAttribute('data-tutorial-id');
            const existing = byId.get(id);
            const visible = node.offsetParent !== null;
            if (!existing || (visible && existing.offsetParent === null)) {
                byId.set(id, node);
            }
        }
        const found = Array.from(byId.entries()).map(([id, node]) => ({
            pageName: id,
            label: node.getAttribute('data-tutorial-label') || id,
            node,
        }));
        const welcomeStep = {
            pageName: '__welcome',
            label: 'Welcome',
            node: null,
            blurb: {
                title: 'Welcome to Geck Inspect',
                body: 'We\'ll walk through each tab in your sidebar and explain what it does. Use the arrows or Esc to skip.',
            },
        };
        const doneStep = {
            pageName: '__done',
            label: 'All set',
            node: null,
            blurb: {
                title: "You're all set",
                body: 'Relaunch this tour anytime from the command palette or the onboarding card on the dashboard. Happy breeding!',
            },
        };

        const tabSteps = found.map((it) => ({
            ...it,
            blurb: STEP_BLURBS[it.pageName] || {
                title: it.label,
                body: `Open ${it.label} to manage this section of the app.`,
            },
        }));

        setSteps([welcomeStep, ...tabSteps, doneStep]);
        setStepIndex(0);
    }, [isOpen]);

    const currentStep = steps[stepIndex] || null;
    const currentNode = currentStep?.node || null;

    // Track the anchor rect so the tooltip follows the element on
    // scroll/resize. useLayoutEffect to measure synchronously before
    // paint.
    useLayoutEffect(() => {
        if (!currentNode) {
            setAnchorRect(null);
            return;
        }

        const update = () => {
            const r = currentNode.getBoundingClientRect();
            setAnchorRect({
                top: r.top,
                left: r.left,
                right: r.right,
                bottom: r.bottom,
                width: r.width,
                height: r.height,
            });
        };

        // Scroll the anchor into view on step change, then measure.
        currentNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Delay the first measure slightly so the scroll can settle.
        setTimeout(update, 180);

        window.addEventListener('scroll', update, { passive: true, capture: true });
        window.addEventListener('resize', update);
        intervalRef.current = setInterval(update, 500);
        return () => {
            window.removeEventListener('scroll', update, { capture: true });
            window.removeEventListener('resize', update);
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [currentNode]);

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

    const placement = useMemo(() => computeTooltipPlacement(anchorRect), [anchorRect]);

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

    // Intro/outro get a centered card. Anchored steps get a tooltip
    // next to the highlighted sidebar item.
    const anchoredStyle =
        isIntro || isOutro
            ? {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 420,
              }
            : placement.style;

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
                className="absolute top-2 right-2 text-slate-500 hover:text-slate-200 rounded-full p-1"
                aria-label="Close tutorial"
            >
                <X className="w-4 h-4" />
            </button>

            <div className="mt-2">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                    <Sparkles className="w-3 h-3" />
                    Step {stepIndex + 1} of {steps.length}
                </div>
                <h2 className="text-lg font-bold mt-2">{blurb.title}</h2>
                <p className="text-sm text-slate-300 mt-1 leading-relaxed">{blurb.body}</p>
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
                    className="text-xs text-slate-500 hover:text-slate-300"
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
