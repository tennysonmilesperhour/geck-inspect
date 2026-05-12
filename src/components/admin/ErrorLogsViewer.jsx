import { useEffect, useMemo, useState } from 'react';
import { ErrorLog } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
    AlertTriangle,
    Bug,
    CheckCircle2,
    Loader2,
    RefreshCw,
    Search,
    Trash2,
    Info,
    AlertOctagon,
    ChevronRight,
} from 'lucide-react';
import { format, formatDistanceToNowStrict, subDays } from 'date-fns';

/**
 * Admin Error Logs ,  captures everything reported by ErrorBoundary, the
 * global window.error handler, and the unhandledrejection listener.
 *
 * Shows volume over the past N days, lets the admin mark items resolved,
 * filter by level / time range / text, and inspect the full stack trace.
 */

const PERIODS = [
    { value: 1, label: 'Last 24h' },
    { value: 7, label: 'Last 7 days' },
    { value: 30, label: 'Last 30 days' },
    { value: 365, label: 'All time' },
];

const LEVEL_META = {
    error: { color: 'border-rose-500/40 text-rose-300 bg-rose-500/10', icon: AlertOctagon },
    warning: { color: 'border-amber-500/40 text-amber-300 bg-amber-500/10', icon: AlertTriangle },
    info: { color: 'border-blue-500/40 text-blue-300 bg-blue-500/10', icon: Info },
};

function LevelBadge({ level }) {
    const meta = LEVEL_META[level] || LEVEL_META.error;
    const Icon = meta.icon;
    return (
        <Badge variant="outline" className={`border ${meta.color} text-[10px] uppercase`}>
            <Icon className="w-3 h-3 mr-1" />
            {level}
        </Badge>
    );
}

export default function ErrorLogsViewer() {
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [period, setPeriod] = useState(7);
    const [level, setLevel] = useState('all');
    const [showResolved, setShowResolved] = useState(false);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(null);
    const { toast } = useToast();

    const load = async () => {
        setIsLoading(true);
        try {
            const data = await ErrorLog.list('-created_date');
            setLogs(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error log fetch failed:', err);
            toast({
                title: 'Could not load',
                description: err.message || 'Database error',
                variant: 'destructive',
            });
        }
        setIsLoading(false);
    };

    useEffect(() => {
        load();
    }, []);

    const filtered = useMemo(() => {
        const cutoff = subDays(new Date(), period).getTime();
        let list = logs.filter((l) => {
            const t = l.created_date ? new Date(l.created_date).getTime() : 0;
            return t >= cutoff;
        });
        if (!showResolved) list = list.filter((l) => !l.resolved);
        if (level !== 'all') list = list.filter((l) => l.level === level);
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(
                (l) =>
                    l.message?.toLowerCase().includes(q) ||
                    l.url?.toLowerCase().includes(q) ||
                    l.user_email?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [logs, period, level, showResolved, search]);

    // Mini sparkline-friendly daily counts.
    const dailyCounts = useMemo(() => {
        const buckets = new Map();
        const cutoff = subDays(new Date(), period).getTime();
        for (const l of logs) {
            const t = l.created_date ? new Date(l.created_date).getTime() : 0;
            if (t < cutoff) continue;
            const key = format(new Date(t), 'yyyy-MM-dd');
            buckets.set(key, (buckets.get(key) || 0) + 1);
        }
        return Array.from(buckets.entries()).sort();
    }, [logs, period]);

    const totals = useMemo(() => {
        const cutoff = subDays(new Date(), period).getTime();
        const inWindow = logs.filter(
            (l) => l.created_date && new Date(l.created_date).getTime() >= cutoff
        );
        return {
            total: inWindow.length,
            unresolved: inWindow.filter((l) => !l.resolved).length,
            errors: inWindow.filter((l) => l.level === 'error').length,
            warnings: inWindow.filter((l) => l.level === 'warning').length,
            uniqueUsers: new Set(inWindow.map((l) => l.user_email).filter(Boolean)).size,
        };
    }, [logs, period]);

    const toggleResolved = async (log) => {
        try {
            await ErrorLog.update(log.id, {
                resolved: !log.resolved,
                resolved_date: !log.resolved ? new Date().toISOString() : null,
            });
            setLogs((prev) =>
                prev.map((l) =>
                    l.id === log.id ? { ...l, resolved: !log.resolved } : l
                )
            );
            if (selected?.id === log.id) {
                setSelected({ ...selected, resolved: !log.resolved });
            }
        } catch (err) {
            toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
        }
    };

    const handleDelete = async (log) => {
        if (!confirm('Delete this error log?')) return;
        try {
            await ErrorLog.delete(log.id);
            setLogs((prev) => prev.filter((l) => l.id !== log.id));
            if (selected?.id === log.id) setSelected(null);
        } catch (err) {
            toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { label: 'Total', value: totals.total, accent: 'text-slate-100' },
                    { label: 'Unresolved', value: totals.unresolved, accent: 'text-rose-300' },
                    { label: 'Errors', value: totals.errors, accent: 'text-rose-300' },
                    { label: 'Warnings', value: totals.warnings, accent: 'text-amber-300' },
                    { label: 'Affected users', value: totals.uniqueUsers, accent: 'text-emerald-300' },
                ].map((s) => (
                    <Card key={s.label} className="bg-slate-900 border-slate-800">
                        <CardContent className="p-4">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">
                                {s.label}
                            </p>
                            <p className={`text-2xl font-bold mt-1 ${s.accent}`}>
                                {s.value.toLocaleString()}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <CardTitle className="text-slate-100 flex items-center gap-2">
                            <Bug className="w-5 h-5 text-rose-400" />
                            Error Log
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2">
                            <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v))}>
                                <SelectTrigger className="w-36 bg-slate-950 border-slate-700 text-slate-200 h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                                    {PERIODS.map((p) => (
                                        <SelectItem key={p.value} value={String(p.value)}>
                                            {p.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={level} onValueChange={setLevel}>
                                <SelectTrigger className="w-32 bg-slate-950 border-slate-700 text-slate-200 h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                                    <SelectItem value="all">All levels</SelectItem>
                                    <SelectItem value="error">Error</SelectItem>
                                    <SelectItem value="warning">Warning</SelectItem>
                                    <SelectItem value="info">Info</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowResolved((v) => !v)}
                                className={`border-slate-700 text-xs h-9 ${
                                    showResolved
                                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                                        : 'bg-slate-800 text-slate-300'
                                }`}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                {showResolved ? 'Hiding none' : 'Hide resolved'}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={load}
                                className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 h-9"
                            >
                                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                Refresh
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                            placeholder="Search message, URL, or user…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 bg-slate-950 border-slate-700 text-slate-200"
                        />
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
                            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-500" />
                            <p>No errors in this window. Healthy.</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[600px] overflow-y-auto">
                            {filtered.map((log) => (
                                <button
                                    key={log.id}
                                    onClick={() => setSelected(log)}
                                    className={`w-full text-left flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                                        log.resolved
                                            ? 'border-slate-800 bg-slate-800/20 opacity-70'
                                            : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800 hover:border-slate-700'
                                    }`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <LevelBadge level={log.level || 'error'} />
                                            <p className="text-sm font-mono text-slate-100 truncate flex-1">
                                                {log.message}
                                            </p>
                                            {log.resolved && (
                                                <Badge
                                                    variant="outline"
                                                    className="border-emerald-500/40 text-emerald-300 text-[10px]"
                                                >
                                                    resolved
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1 truncate">
                                            {log.user_email || 'anonymous'} · {log.url || 'unknown URL'}
                                            {' · '}
                                            {log.created_date &&
                                                formatDistanceToNowStrict(new Date(log.created_date), {
                                                    addSuffix: true,
                                                })}
                                        </p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-600 shrink-0 mt-1" />
                                </button>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
                <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-3xl max-h-[90vh] overflow-y-auto">
                    {selected && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 flex-wrap">
                                    <LevelBadge level={selected.level || 'error'} />
                                    Error details
                                </DialogTitle>
                                <DialogDescription className="text-slate-400">
                                    {selected.created_date && format(new Date(selected.created_date), 'PPpp')}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                                        Message
                                    </p>
                                    <pre className="text-sm font-mono text-slate-100 whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-3">
                                        {selected.message}
                                    </pre>
                                </div>
                                {selected.stack && (
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                                            Stack trace
                                        </p>
                                        <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-3 max-h-64 overflow-auto">
                                            {selected.stack}
                                        </pre>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div>
                                        <p className="text-slate-500 uppercase tracking-wider mb-1">URL</p>
                                        <p className="text-slate-200 break-all">{selected.url || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500 uppercase tracking-wider mb-1">User</p>
                                        <p className="text-slate-200">{selected.user_email || 'anonymous'}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-slate-500 uppercase tracking-wider mb-1">User agent</p>
                                        <p className="text-slate-200 break-all">{selected.user_agent || '—'}</p>
                                    </div>
                                    {selected.context && Object.keys(selected.context).length > 0 && (
                                        <div className="col-span-2">
                                            <p className="text-slate-500 uppercase tracking-wider mb-1">Context</p>
                                            <pre className="text-slate-200 font-mono text-[11px] rounded border border-slate-800 bg-slate-950 p-2 overflow-auto max-h-40">
                                                {JSON.stringify(selected.context, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                                    <Button
                                        variant="ghost"
                                        onClick={() => handleDelete(selected)}
                                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
                                    >
                                        <Trash2 className="w-4 h-4 mr-1.5" />
                                        Delete
                                    </Button>
                                    <Button
                                        onClick={() => toggleResolved(selected)}
                                        className={
                                            selected.resolved
                                                ? 'bg-slate-700 hover:bg-slate-600 text-slate-100'
                                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                        }
                                    >
                                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                        {selected.resolved ? 'Mark unresolved' : 'Mark resolved'}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
