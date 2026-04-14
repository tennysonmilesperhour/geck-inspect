import { useState } from 'react';
import { Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Reusable page-level settings panel.
 * 
 * Usage:
 *   <PageSettingsPanel title="My Geckos Settings">
 *     <div>...your settings controls...</div>
 *   </PageSettingsPanel>
 */
export default function PageSettingsPanel({ title = 'Page Settings', children, className = '' }) {
    const [open, setOpen] = useState(false);

    return (
        <div className={`relative ${className}`}>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(o => !o)}
                className="border-slate-600 hover:bg-slate-800 text-slate-300 gap-1.5"
                title={title}
            >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
            </Button>

            {open && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    {/* Panel */}
                    <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 space-y-3">
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
                    </div>
                </>
            )}
        </div>
    );
}