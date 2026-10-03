import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LifeBuoy, Loader2, MessageSquareReply } from 'lucide-react';
import { format } from 'date-fns';
import {
    MEMBER_STATUS_LABELS,
    loadMySupportTickets,
    memberFacingBody,
    memberFacingSubject,
} from '@/lib/supportTickets';

const STATUS_STYLES = {
    new: 'border-slate-600 text-slate-300',
    in_progress: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
    resolved: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
    archived: 'border-slate-700 text-slate-400',
};

/**
 * "Your support messages": every message and report a member sent the
 * team, its status, and the team's replies. Before this, replies went out
 * only as direct messages and a member could not tell whether a report had
 * been read.
 */
export default function MySupportTickets({ user }) {
    const [tickets, setTickets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setIsLoading(true);
            try {
                const rows = await loadMySupportTickets(user?.email);
                if (!cancelled) setTickets(rows);
            } catch (err) {
                if (!cancelled) setError(err.message || 'Could not load your support messages.');
            }
            if (!cancelled) setIsLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [user?.email]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                    <LifeBuoy className="w-5 h-5" />
                    Your support messages
                </CardTitle>
                <p className="text-sm text-slate-400">
                    Messages and reports you sent the Geck Inspect team, where each one stands, and our replies.
                </p>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                    </div>
                ) : error ? (
                    <p role="alert" className="text-sm text-rose-300">{error}</p>
                ) : tickets.length === 0 ? (
                    <p className="text-sm text-slate-500">
                        Nothing yet. Messages you send from the Membership page, the feedback button or a
                        Report button show up here with our replies.
                    </p>
                ) : (
                    <ul className="space-y-3">
                        {tickets.map((ticket) => {
                            const body = memberFacingBody(ticket);
                            const answered = ticket.replies.length > 0;
                            return (
                                <li key={ticket.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                                    <div className="flex items-start justify-between gap-2 flex-wrap">
                                        <p className="text-sm font-semibold text-slate-100">{memberFacingSubject(ticket)}</p>
                                        <div className="flex items-center gap-1.5">
                                            {answered && (
                                                <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[10px] uppercase tracking-wider">
                                                    Answered
                                                </Badge>
                                            )}
                                            <Badge variant="outline" className={`${STATUS_STYLES[ticket.status] || STATUS_STYLES.new} text-[10px] uppercase tracking-wider`}>
                                                {MEMBER_STATUS_LABELS[ticket.status] || MEMBER_STATUS_LABELS.new}
                                            </Badge>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Sent {format(new Date(ticket.created_date), 'MMM d, yyyy')}
                                    </p>
                                    {body && (
                                        <p className="text-sm text-slate-300 whitespace-pre-wrap mt-2 line-clamp-4">{body}</p>
                                    )}
                                    {ticket.replies.map((reply) => (
                                        <div key={reply.id} className="mt-3 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
                                            <p className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                                                <MessageSquareReply className="w-3.5 h-3.5" />
                                                Geck Inspect support, {format(new Date(reply.created_at), 'MMM d, yyyy')}
                                            </p>
                                            <p className="text-sm text-slate-200 whitespace-pre-wrap mt-1">{reply.body}</p>
                                        </div>
                                    ))}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
