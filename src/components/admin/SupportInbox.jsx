import { useEffect, useMemo, useState } from 'react';
import { SupportMessage, User } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import {
    LifeBuoy,
    Loader2,
    Search,
    Inbox,
    Clock,
    CheckCircle2,
    Archive as ArchiveIcon,
    Trash2,
    Send,
    User as UserIcon,
    Heart,
    Bug,
    Lightbulb,
    Star,
} from 'lucide-react';
import { formatDistanceToNowStrict, format } from 'date-fns';

/**
 * Admin Support Inbox — triage view for user-submitted support_messages.
 *
 * - Status tabs: New / In Progress / Resolved / Archived
 * - Search filter across subject, body, and user_email
 * - Click a row to open the full thread + admin notes editor
 * - Status can be moved via the dropdown; changes persist immediately
 * - "Reply via DM" button drops the admin into Messages prefilled with
 *   the user's email as the recipient
 */

const STATUSES = [
    { value: 'new', label: 'New', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', icon: Inbox },
    { value: 'in_progress', label: 'In progress', color: 'bg-amber-500/15 text-amber-300 border-amber-500/40', icon: Clock },
    { value: 'resolved', label: 'Resolved', color: 'bg-blue-500/15 text-blue-300 border-blue-500/40', icon: CheckCircle2 },
    { value: 'archived', label: 'Archived', color: 'bg-slate-700/40 text-slate-300 border-slate-600', icon: ArchiveIcon },
];

const SOURCES = [
    { value: 'all', label: 'All', color: 'border-slate-700 text-slate-300', icon: Inbox },
    { value: 'support', label: 'Support', color: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10', icon: LifeBuoy },
    { value: 'feedback', label: 'Feedback', color: 'border-purple-500/40 text-purple-300 bg-purple-500/10', icon: Heart },
    { value: 'bug_report', label: 'Bug', color: 'border-rose-500/40 text-rose-300 bg-rose-500/10', icon: Bug },
    { value: 'feature_request', label: 'Feature req.', color: 'border-amber-500/40 text-amber-300 bg-amber-500/10', icon: Lightbulb },
];

function SourceBadge({ source }) {
    const meta = SOURCES.find((s) => s.value === source);
    if (!meta || meta.value === 'all') return null;
    const Icon = meta.icon;
    return (
        <Badge variant="outline" className={`border ${meta.color} text-[10px] uppercase tracking-wider`}>
            <Icon className="w-3 h-3 mr-1" />
            {meta.label}
        </Badge>
    );
}

function RatingStars({ value }) {
    if (!value) return null;
    return (
        <span className="inline-flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
                <Star
                    key={n}
                    className={`w-3 h-3 ${
                        n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                    }`}
                />
            ))}
        </span>
    );
}

function StatusBadge({ status }) {
    const meta = STATUSES.find((s) => s.value === status) || STATUSES[0];
    const Icon = meta.icon;
    return (
        <Badge variant="outline" className={`border ${meta.color} text-[10px] uppercase tracking-wider`}>
            <Icon className="w-3 h-3 mr-1" />
            {meta.label}
        </Badge>
    );
}

export default function SupportInbox() {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeStatus, setActiveStatus] = useState('new');
    const [activeSource, setActiveSource] = useState('all');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(null);
    const [adminNotes, setAdminNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const loadMessages = async () => {
        setIsLoading(true);
        try {
            const data = await SupportMessage.list('-created_date');
            setMessages(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to load support messages:', err);
            toast({
                title: 'Load failed',
                description: 'Could not load support inbox.',
                variant: 'destructive',
            });
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadMessages();
    }, []);

    const counts = useMemo(() => {
        const c = { new: 0, in_progress: 0, resolved: 0, archived: 0 };
        for (const m of messages) {
            if (m.status in c) c[m.status]++;
        }
        return c;
    }, [messages]);

    const sourceCounts = useMemo(() => {
        const c = { all: messages.length, support: 0, feedback: 0, bug_report: 0, feature_request: 0 };
        for (const m of messages) {
            const src = m.source || 'support';
            if (src in c) c[src]++;
        }
        return c;
    }, [messages]);

    const filtered = useMemo(() => {
        let list = messages.filter((m) => m.status === activeStatus);
        if (activeSource !== 'all') {
            list = list.filter((m) => (m.source || 'support') === activeSource);
        }
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(
                (m) =>
                    m.subject?.toLowerCase().includes(q) ||
                    m.body?.toLowerCase().includes(q) ||
                    m.user_email?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [messages, activeStatus, activeSource, search]);

    const openMessage = (msg) => {
        setSelected(msg);
        setAdminNotes(msg.admin_notes || '');
    };

    const closeMessage = () => {
        if (isSaving) return;
        setSelected(null);
        setAdminNotes('');
    };

    const handleSaveNotes = async () => {
        if (!selected?.id) return;
        setIsSaving(true);
        try {
            await SupportMessage.update(selected.id, { admin_notes: adminNotes });
            toast({ title: 'Notes saved' });
            setMessages((prev) =>
                prev.map((m) => (m.id === selected.id ? { ...m, admin_notes: adminNotes } : m))
            );
            setSelected((s) => (s ? { ...s, admin_notes: adminNotes } : s));
        } catch (err) {
            toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
        }
        setIsSaving(false);
    };

    const handleChangeStatus = async (msg, newStatus) => {
        try {
            const patch = { status: newStatus };
            if (newStatus === 'resolved') {
                const me = await User.me().catch(() => null);
                patch.resolved_by = me?.email || null;
                patch.resolved_date = new Date().toISOString();
            }
            await SupportMessage.update(msg.id, patch);
            setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...patch } : m)));
            if (selected?.id === msg.id) setSelected((s) => ({ ...s, ...patch }));
            toast({ title: `Moved to ${newStatus.replace('_', ' ')}` });
        } catch (err) {
            toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
        }
    };

    const handleDelete = async (msg) => {
        if (!confirm(`Delete this support message?\n\n"${msg.subject}"`)) return;
        try {
            await SupportMessage.delete(msg.id);
            setMessages((prev) => prev.filter((m) => m.id !== msg.id));
            if (selected?.id === msg.id) setSelected(null);
            toast({ title: 'Deleted' });
        } catch (err) {
            toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
        }
    };

    return (
        <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                    <LifeBuoy className="w-5 h-5 text-emerald-400" />
                    Support Inbox
                </CardTitle>
                <p className="text-sm text-slate-400">
                    Messages users filed from the Membership page and other support entry points.
                </p>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-2 mb-3">
                    {STATUSES.map((s) => {
                        const Icon = s.icon;
                        const isActive = activeStatus === s.value;
                        return (
                            <button
                                key={s.value}
                                onClick={() => setActiveStatus(s.value)}
                                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                                    isActive
                                        ? s.color
                                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                            >
                                <Icon className="w-3 h-3" />
                                {s.label}
                                <span className="text-[10px] opacity-80">({counts[s.value] || 0})</span>
                            </button>
                        );
                    })}
                </div>
                <div className="flex flex-wrap gap-2 mb-4 pb-3 border-b border-slate-800">
                    {SOURCES.map((s) => {
                        const Icon = s.icon;
                        const isActive = activeSource === s.value;
                        return (
                            <button
                                key={s.value}
                                onClick={() => setActiveSource(s.value)}
                                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                    isActive
                                        ? s.color
                                        : 'border-slate-800 bg-slate-900 text-slate-500 hover:bg-slate-800'
                                }`}
                            >
                                <Icon className="w-3 h-3" />
                                {s.label}
                                <span className="text-[10px] opacity-80">
                                    ({sourceCounts[s.value] || 0})
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                        placeholder="Search subject, body, or user email..."
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
                        <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p>No messages in this bucket.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filtered.map((msg) => (
                            <button
                                key={msg.id}
                                onClick={() => openMessage(msg)}
                                className="w-full text-left flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-800/40 hover:bg-slate-800 hover:border-emerald-500/40 p-3 transition-colors"
                            >
                                <div
                                    className="w-9 h-9 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0"
                                    aria-hidden
                                >
                                    <UserIcon className="w-4 h-4 text-slate-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-semibold text-slate-100 truncate">
                                            {msg.subject}
                                        </p>
                                        <StatusBadge status={msg.status} />
                                        <SourceBadge source={msg.source || 'support'} />
                                        <RatingStars value={msg.rating} />
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                                        {msg.user_email || '(anonymous)'} ·{' '}
                                        {formatDistanceToNowStrict(new Date(msg.created_date), {
                                            addSuffix: true,
                                        })}
                                        {msg.page && (
                                            <span className="ml-2 text-slate-600">
                                                · from {msg.page}
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs text-slate-400 line-clamp-2 mt-1">{msg.body}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </CardContent>

            {/* Detail modal */}
            <Dialog open={!!selected} onOpenChange={(open) => !open && closeMessage()}>
                <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-2xl max-h-[90vh] overflow-y-auto">
                    {selected && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 flex-wrap">
                                    {selected.subject}
                                    <StatusBadge status={selected.status} />
                                    <SourceBadge source={selected.source || 'support'} />
                                </DialogTitle>
                                <DialogDescription className="text-slate-400">
                                    From <span className="text-slate-200">{selected.user_email || '(anonymous)'}</span>
                                    {' · '}
                                    {format(new Date(selected.created_date), 'PPp')}
                                    {selected.page && (
                                        <span className="ml-2 text-slate-500">· {selected.page}</span>
                                    )}
                                    {selected.rating && (
                                        <span className="ml-2 inline-flex items-center gap-1">
                                            · <RatingStars value={selected.rating} />
                                        </span>
                                    )}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                                <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-4">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                                        Message
                                    </p>
                                    <p className="text-sm text-slate-200 whitespace-pre-wrap">
                                        {selected.body}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                                        Admin notes (internal)
                                    </p>
                                    <Textarea
                                        value={adminNotes}
                                        onChange={(e) => setAdminNotes(e.target.value)}
                                        placeholder="Private notes, follow-ups, context..."
                                        className="bg-slate-950 border-slate-700 text-slate-100 min-h-24"
                                    />
                                    <div className="flex justify-end mt-2">
                                        <Button
                                            size="sm"
                                            onClick={handleSaveNotes}
                                            disabled={isSaving}
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white"
                                        >
                                            {isSaving && (
                                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                            )}
                                            Save notes
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                                            Change status
                                        </p>
                                        <Select
                                            value={selected.status}
                                            onValueChange={(v) => handleChangeStatus(selected, v)}
                                        >
                                            <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                                                {STATUSES.map((s) => (
                                                    <SelectItem key={s.value} value={s.value}>
                                                        {s.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {selected.user_email && (
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                                                Quick actions
                                            </p>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    window.location.href = `/Messages?recipient=${encodeURIComponent(selected.user_email)}`;
                                                }}
                                                className="w-full border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                                            >
                                                <Send className="w-3.5 h-3.5 mr-1.5" />
                                                Reply via DM
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <DialogFooter className="flex items-center justify-between sm:justify-between">
                                <Button
                                    variant="ghost"
                                    onClick={() => handleDelete(selected)}
                                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
                                >
                                    <Trash2 className="w-4 h-4 mr-1.5" />
                                    Delete
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={closeMessage}
                                    className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                                >
                                    Close
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </Card>
    );
}
