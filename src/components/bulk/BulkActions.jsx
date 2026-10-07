import { useId, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { matchesCategories, runBulkAction } from '@/lib/bulkActions';

/** Records must already be scoped to the current view and write permissions. */
export default function BulkActions({ records, noun, categories = [], actions, getLabel, onComplete }) {
    const id = useId();
    const lock = useRef(false);
    const [open, setOpen] = useState(false);
    const [filters, setFilters] = useState({});
    const [selected, setSelected] = useState([]);
    const [actionId, setActionId] = useState('');
    const [value, setValue] = useState('');
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [result, setResult] = useState(null);
    const [refreshError, setRefreshError] = useState(null);
    const matching = useMemo(() => records.filter(r => matchesCategories(r, filters)), [records, filters]);
    // Hidden or no-longer-writable rows never participate in a batch.
    const targets = matching.filter(r => selected.includes(r.id));
    const action = actions.find(a => a.id === actionId);
    const valid = targets.length > 0 && action && (!action.options || action.options.includes(value)) && (!action.input || value.trim() !== '') && (!action.validate || !action.validate(value, targets));
    const fieldClass = 'min-h-11 rounded-md border border-slate-600 bg-slate-800 text-slate-100 px-3 py-2 w-full';
    const reset = () => {
        setSelected([]); setFilters({}); setActionId(''); setValue(''); setResult(null); setRefreshError(null); setConfirming(false);
    };
    const apply = async () => {
        if (!valid || lock.current) return;
        lock.current = true;
        setBusy(true); setResult(null); setRefreshError(null);
        try {
            const outcome = await runBulkAction(targets, r => action.run(r, value));
            setResult(outcome);
            setSelected(outcome.failed.map(r => r.id));
            setConfirming(false);
            try { await onComplete?.(outcome); }
            catch { setRefreshError('Changes were saved, but the view could not refresh. Reload before continuing.'); }
        } finally {
            setBusy(false); lock.current = false;
        }
    };
    return (
        <>
            <Button type="button" variant="outline" className="my-3" disabled={!records.length} onClick={() => { reset(); setOpen(true); }}>Bulk actions: {noun}</Button>
            <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}>
                <DialogContent className="bg-slate-900 text-slate-100 border-slate-700 max-w-3xl max-h-[90vh] overflow-y-auto" onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onPointerDownOutside={e => { if (busy) e.preventDefault(); }}>
                    <DialogHeader>
                        <DialogTitle>Bulk actions: {noun}</DialogTitle>
                        <DialogDescription>Select individual records or all records matching your categories. Existing page filters still apply.</DialogDescription>
                    </DialogHeader>
                    <fieldset disabled={busy || confirming} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {categories.map(category => {
                                const options = [...new Set(records.flatMap(r => Array.isArray(r[category.key]) ? r[category.key] : [r[category.key]]).filter(v => v != null && v !== '').map(String))].sort();
                                return <label key={category.key} className="text-sm">{category.label}
                                    <select className={fieldClass} value={filters[category.key] || ''} onChange={e => { setFilters(prev => ({ ...prev, [category.key]: e.target.value })); setSelected([]); setResult(null); }}>
                                        <option value="">All</option>
                                        {options.map(v => <option key={v} value={v}>{category.format?.(v) || v}</option>)}
                                    </select>
                                </label>;
                            })}
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <Button type="button" variant="outline" disabled={!matching.length} onClick={() => setSelected(matching.map(r => r.id))}>Select all matching ({matching.length})</Button>
                            <Button type="button" variant="ghost" onClick={() => setSelected([])}>Clear selection</Button>
                            <span aria-live="polite">{targets.length} selected</span>
                        </div>
                        <div className="max-h-64 overflow-y-auto border border-slate-700 rounded-md">
                            {matching.map(r => <label key={r.id} className="flex gap-3 items-center p-3 border-b border-slate-800 cursor-pointer">
                                <input type="checkbox" className="h-5 w-5 shrink-0" checked={selected.includes(r.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev, r.id] : prev.filter(x => x !== r.id))} />
                                <span>{getLabel(r)}</span>
                            </label>)}
                            {!matching.length && <p className="p-3 text-slate-400">No records match these categories.</p>}
                        </div>
                        <label htmlFor={`${id}-action`} className="block text-sm">Action</label>
                        <select id={`${id}-action`} className={fieldClass} value={actionId} onChange={e => { setActionId(e.target.value); setValue(''); setResult(null); }}>
                            <option value="">Choose an action</option>
                            {actions.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                        </select>
                        {action?.description && <p className="text-sm text-slate-400">{action.description}</p>}
                        {action?.options && <label className="block text-sm">New value
                            <select className={fieldClass} value={value} onChange={e => setValue(e.target.value)}>
                                <option value="">Choose a value</option>
                                {action.options.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </label>}
                        {action?.input && <label className="block text-sm">{action.inputLabel || 'New value'}
                            <Input type={action.input} value={value} min={action.min} max={action.max} step={action.step} onChange={e => setValue(e.target.value)} />
                        </label>}
                        {action?.validate?.(value, targets) && value && <p role="alert" className="text-amber-300 text-sm">{action.validate(value, targets)}</p>}
                    </fieldset>
                    {result && <div role="status" className="text-sm space-y-2">
                        <p>{result.succeeded.length} succeeded. {result.failed.length} failed.{result.failed.length > 0 && ' Failed records remain selected for retry.'}</p>
                        {result.failed.map(r => <p key={r.id} className="text-red-300">{getLabel(records.find(x => x.id === r.id) || { id: r.id })}: {r.message}</p>)}
                    </div>}
                    {refreshError && <p role="alert" className="text-amber-300">{refreshError}</p>}
                    {confirming ? <div className="space-y-3 border border-amber-700 rounded-md p-3">
                        <p>{action?.label}{value ? `: ${value}` : ''} for {targets.length} {noun}?</p>
                        {action?.destructive && <p className="text-red-300">Deletion is permanent and cannot be undone.</p>}
                        <div className="flex gap-3">
                            <Button type="button" disabled={busy} variant={action?.destructive ? 'destructive' : 'default'} onClick={apply}>{busy ? 'Applying…' : 'Confirm'}</Button>
                            <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Back</Button>
                        </div>
                    </div> : <Button type="button" disabled={!valid || busy || !!refreshError} onClick={() => setConfirming(true)}>Review changes</Button>}
                </DialogContent>
            </Dialog>
        </>
    );
}
