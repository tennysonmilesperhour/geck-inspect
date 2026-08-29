import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Settings, X, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import useAnchoredPosition from '@/hooks/useAnchoredPosition';

/**
 * Reusable page-level settings panel.
 *
 * Renders a gear-icon button that opens a floating dropdown with
 * page-specific settings. A footer link directs users to the main
 * Settings page for account-wide preferences.
 *
 * The panel is portalled to the document body and positioned with
 * useAnchoredPosition, so it floats above page content regardless of
 * parent stacking contexts and stays inside the viewport on mobile,
 * where the gear often sits at the far left of a full-width toolbar.
 *
 * Usage:
 *   <PageSettingsPanel title="My Geckos Settings">
 *     <div>...your settings controls...</div>
 *   </PageSettingsPanel>
 */
export default function PageSettingsPanel({ title = 'Page Settings', children, className = '' }) {
    const [open, setOpen] = useState(false);
    const { anchorRef, panelRef, style } = useAnchoredPosition(open);

    return (
        <div className={`${className}`}>
            <Button
                ref={anchorRef}
                variant="outline"
                size="icon"
                onClick={() => setOpen(o => !o)}
                className="border-slate-600 hover:bg-slate-800 text-slate-300 h-8 w-8"
                title={title}
            >
                <Settings className="w-4 h-4" />
            </Button>

            {open && createPortal(
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
                    {/* Panel */}
                    <div
                        ref={panelRef}
                        style={style}
                        className="z-[9999] w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 space-y-3"
                    >
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-slate-100 font-semibold text-sm flex items-center gap-2">
                                <Settings className="w-4 h-4 text-emerald-400" />
                                {title}
                            </h3>
                            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-200">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="border-t border-slate-700 pt-3 space-y-3">
                            {children}
                        </div>
                        <div className="border-t border-slate-700 pt-2">
                            <Link
                                to={createPageUrl('Settings')}
                                onClick={() => setOpen(false)}
                                className="flex items-center justify-between text-[11px] text-slate-500 hover:text-emerald-400 transition-colors"
                            >
                                <span>All settings</span>
                                <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}
