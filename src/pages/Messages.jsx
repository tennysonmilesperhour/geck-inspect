import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import Seo from '@/components/seo/Seo';
import { DirectMessage, User } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
import { notifyNewMessage } from '@/components/notifications/NotificationService';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PageSettingsPanel from '@/components/ui/PageSettingsPanel';
import usePageSettings from '@/hooks/usePageSettings';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Mail, Send, Search, MessageSquare, ArrowLeft, Plus, MoreVertical, Trash2, CheckCircle2, Circle, X } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import { initialsAvatarUrl } from '@/components/shared/InitialsAvatar';
import { format, isSameDay, isToday, isYesterday, differenceInMinutes } from 'date-fns';

const SYSTEM_EMAIL = 'system@geckinspect.com';

// Users can delete their own messages for both sides within this window.
// Outside the window, the message is locked ,  no UI affordance to delete
// it. The client gate matches the intended server-side RLS policy.
const UNSEND_WINDOW_MS = 5 * 60 * 1000;

function canUnsend(message, myEmail, now = Date.now()) {
    if (!message || !myEmail) return false;
    if (message.sender_email !== myEmail) return false;
    const createdMs = new Date(message.created_date).getTime();
    if (Number.isNaN(createdMs)) return false;
    return now - createdMs <= UNSEND_WINDOW_MS;
}

// Resolve the display name + avatar URL for a given email, preferring a
// real profile when we have one and falling back to the email prefix +
// auto-generated initials avatar. The system identity gets its own brand
// label so it reads as "Geck Inspect Team" rather than "system".
function resolveProfile(email, profileMap) {
    if (email === SYSTEM_EMAIL) {
        return {
            displayName: 'Geck Inspect Team',
            avatarUrl: initialsAvatarUrl('Geck Inspect', 64),
            isSystem: true,
        };
    }
    const profile = profileMap?.get(email);
    const displayName = profile?.full_name || email.split('@')[0];
    const avatarUrl =
        profile?.profile_image_url || initialsAvatarUrl(displayName, 64);
    return { displayName, avatarUrl, isSystem: false };
}

// Label shown in the sticky date divider between message groups.
function formatDateDivider(date) {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
}

// Compute per-message flags used for visual grouping:
//   - showDateDivider: first message of a calendar day
//   - isFirstInGroup:  new sender, OR >5min gap, OR new day
//   - isLastInGroup:   bubble should render the timestamp footer
// Walks the chronological list once, O(n).
function annotateMessages(messages) {
    const out = [];
    for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const date = new Date(message.created_date);
        const prevDate = prev ? new Date(prev.created_date) : null;
        const nextDate = next ? new Date(next.created_date) : null;

        const showDateDivider = !prev || !isSameDay(prevDate, date);
        const sameSenderAsPrev =
            prev && prev.sender_email === message.sender_email && !showDateDivider;
        const recentAfterPrev =
            prev && prevDate && differenceInMinutes(date, prevDate) <= 5;
        const isFirstInGroup = !sameSenderAsPrev || !recentAfterPrev;

        const sameSenderAsNext =
            next && next.sender_email === message.sender_email;
        const sameDayAsNext = next && isSameDay(nextDate, date);
        const recentBeforeNext =
            next && nextDate && differenceInMinutes(nextDate, date) <= 5;
        const isLastInGroup =
            !sameSenderAsNext || !sameDayAsNext || !recentBeforeNext;

        out.push({ message, showDateDivider, isFirstInGroup, isLastInGroup, date });
    }
    return out;
}

/**
 * Messages page ,  dark slate shell to match the rest of the app, but
 * the individual message bubbles themselves use a cream background
 * with black ink so long message bodies are easy to read. Only the
 * bubbles get recolored; the page background, conversation list, and
 * composer stay on the app's standard dark theme.
 */

// Bubble color tokens ,  kept inline so we don't have to extend Tailwind.
const BUBBLE_INCOMING_BG = '#fdf6e3';
const BUBBLE_INCOMING_BORDER = '#e7dcc0';
const BUBBLE_SYSTEM_BG = '#fff7d6';
const BUBBLE_SYSTEM_BORDER = '#e3d49f';
const BUBBLE_OUTGOING_BG = '#fefaf0';
const BUBBLE_OUTGOING_BORDER = '#d4c89a';
const BUBBLE_INK = '#1a1a1a';
const BUBBLE_INK_MUTED = '#6b6658';

export default function MessagesPage() {
    const { toast } = useToast();
    const [msgPrefs, setMsgPrefs] = usePageSettings('messages_prefs', {
        previewLines: '1',
        enterToSend: true,
    });
    const [currentUser, setCurrentUser] = useState(null);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [profileMap, setProfileMap] = useState(() => new Map());
    const [newMessage, setNewMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [composeSearch, setComposeSearch] = useState('');
    const [allProfiles, setAllProfiles] = useState(null); // null = not yet loaded
    const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    // Ticks every 30s so the unsend-window check re-evaluates and
    // checkboxes on messages that just aged out of the window disappear.
    const [nowTick, setNowTick] = useState(() => Date.now());
    const scrollAnchorRef = useRef(null);

    useEffect(() => {
        const id = setInterval(() => setNowTick(Date.now()), 30 * 1000);
        return () => clearInterval(id);
    }, []);

    // When a message ages out of the unsend window, drop it from any
    // in-flight selection so the "Delete (N)" button count stays honest.
    useEffect(() => {
        if (!isSelectMode) return;
        setSelectedIds((prev) => {
            if (prev.size === 0) return prev;
            const next = new Set();
            for (const message of selectedConversation?.messages || []) {
                if (prev.has(message.id) && canUnsend(message, currentUser?.email, nowTick)) {
                    next.add(message.id);
                }
            }
            return next.size === prev.size ? prev : next;
        });
    }, [nowTick, isSelectMode, selectedConversation, currentUser?.email]);

    // Exit select mode whenever the user switches conversations so an
    // in-flight selection can't silently carry over to an unrelated one.
    useEffect(() => {
        setIsSelectMode(false);
        setSelectedIds(new Set());
    }, [selectedConversation?.email]);

    const toggleSelected = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Remove a set of messages from local state without waiting for the
    // realtime channel to round-trip ,  feels instant and avoids the brief
    // period where deleted bubbles reappear before the channel fires.
    const pruneMessagesLocally = (idsToRemove) => {
        const idSet = idsToRemove instanceof Set ? idsToRemove : new Set(idsToRemove);
        setConversations((prev) =>
            prev
                .map((c) => {
                    const kept = c.messages.filter((m) => !idSet.has(m.id));
                    if (kept.length === c.messages.length) return c;
                    if (kept.length === 0) return null;
                    const latestMessage = kept[kept.length - 1];
                    const unreadCount = kept.filter(
                        (m) => m.recipient_email === currentUser?.email && !m.is_read
                    ).length;
                    return { ...c, messages: kept, latestMessage, unreadCount };
                })
                .filter(Boolean)
        );
        setSelectedConversation((prev) => {
            if (!prev) return prev;
            const kept = prev.messages.filter((m) => !idSet.has(m.id));
            if (kept.length === prev.messages.length) return prev;
            return {
                ...prev,
                messages: kept,
                latestMessage: kept[kept.length - 1] || null,
            };
        });
    };

    const deleteSelected = async () => {
        if (selectedIds.size === 0) return;
        // Re-check the unsend window at click time. A message could have
        // aged out while the user was lingering in select mode.
        const now = Date.now();
        const eligibleIds = Array.from(selectedIds).filter((id) => {
            const message = selectedConversation?.messages.find((m) => m.id === id);
            return canUnsend(message, currentUser?.email, now);
        });
        if (eligibleIds.length === 0) {
            toast({
                title: 'Nothing to unsend',
                description: 'These messages are outside the 5-minute window.',
                variant: 'destructive',
            });
            setSelectedIds(new Set());
            return;
        }
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('direct_messages')
                .delete()
                .in('id', eligibleIds);
            if (error) throw error;
            pruneMessagesLocally(eligibleIds);
            setSelectedIds(new Set());
            setIsSelectMode(false);
            window.dispatchEvent(
                new CustomEvent('unread_counts_changed', { detail: { kind: 'messages' } })
            );
            toast({
                title: `Unsent ${eligibleIds.length} message${eligibleIds.length === 1 ? '' : 's'}.`,
            });
        } catch (error) {
            console.error('Delete failed:', error);
            toast({
                title: 'Unsend failed',
                description: error.message || 'Please try again.',
                variant: 'destructive',
            });
        }
        setIsDeleting(false);
    };


    // Lazy-load the full user directory the first time the compose dialog
    // opens. Small apps can get away with fetching everyone; if the user
    // base ever gets big, swap this for a server-side ILIKE search.
    const openCompose = async () => {
        setIsComposeOpen(true);
        setComposeSearch('');
        if (allProfiles !== null || isLoadingProfiles) return;
        setIsLoadingProfiles(true);
        try {
            const { data } = await supabase
                .from('profiles')
                .select('email, full_name, profile_image_url')
                .order('full_name', { ascending: true })
                .limit(2000);
            setAllProfiles(data || []);
        } catch (err) {
            console.error('Failed to load user directory:', err);
            setAllProfiles([]);
        }
        setIsLoadingProfiles(false);
    };

    const startConversationWith = (profile) => {
        const existing = conversations.find((c) => c.email === profile.email);
        if (existing) {
            setSelectedConversation(existing);
        } else {
            setSelectedConversation({
                email: profile.email,
                messages: [],
                latestMessage: null,
                unreadCount: 0,
                isSystem: false,
            });
            setProfileMap((prev) => {
                const next = new Map(prev);
                next.set(profile.email, profile);
                return next;
            });
        }
        setIsComposeOpen(false);
    };

    // Jump to the latest bubble whenever the visible conversation gains a
    // new message or the user switches conversations. `instant` on open so
    // you don't watch the view scroll; `smooth` on new-message so it reads
    // as an arrival.
    useEffect(() => {
        const anchor = scrollAnchorRef.current;
        if (!anchor) return;
        anchor.scrollIntoView({ behavior: 'auto', block: 'end' });
    }, [selectedConversation?.email]);

    useEffect(() => {
        const anchor = scrollAnchorRef.current;
        if (!anchor) return;
        anchor.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [selectedConversation?.messages?.length]);

    useEffect(() => {
        let currentUserRef = null;

        const loadData = async (isInitial = false) => {
            if (isInitial) setIsLoading(true);
            try {
                const user = currentUserRef || await User.me();
                if (!currentUserRef) {
                    currentUserRef = user;
                    setCurrentUser(user);
                }

                // Server-side filter: only fetch messages involving this user.
                const { data: userMessages, error: msgError } = await supabase
                    .from('direct_messages')
                    .select('*')
                    .or(`sender_email.eq.${user.email},recipient_email.eq.${user.email}`)
                    .order('created_date', { ascending: false })
                    .limit(500);

                if (msgError) throw msgError;

                const convMap = new Map();
                (userMessages || []).forEach(message => {
                    const otherEmail = message.sender_email === user.email
                        ? message.recipient_email
                        : message.sender_email;

                    if (!convMap.has(otherEmail)) {
                        convMap.set(otherEmail, []);
                    }
                    convMap.get(otherEmail).push(message);
                });

                const conversationList = Array.from(convMap.entries()).map(([email, msgs]) => {
                    const latestMessage = msgs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
                    const unreadCount = msgs.filter(m => m.recipient_email === user.email && !m.is_read).length;

                    return {
                        email,
                        messages: msgs.sort((a, b) => new Date(a.created_date) - new Date(b.created_date)),
                        latestMessage,
                        unreadCount,
                        isSystem: email === SYSTEM_EMAIL,
                    };
                });

                conversationList.sort((a, b) => new Date(b.latestMessage.created_date) - new Date(a.latestMessage.created_date));
                setConversations(conversationList);

                // Fetch display profiles for everyone in this inbox in one
                // round trip so the list can show real names + avatars
                // instead of email prefixes.
                const otherEmails = conversationList
                    .map((c) => c.email)
                    .filter((e) => e && e !== SYSTEM_EMAIL);
                if (otherEmails.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('email, full_name, profile_image_url')
                        .in('email', otherEmails);
                    if (profiles) {
                        setProfileMap((prev) => {
                            const next = new Map(prev);
                            for (const p of profiles) next.set(p.email, p);
                            return next;
                        });
                    }
                }

                if (isInitial) {
                    const urlParams = new URLSearchParams(window.location.search);
                    const recipientEmail = urlParams.get('recipient');
                    if (recipientEmail) {
                        const conversation = conversationList.find(c => c.email === recipientEmail);
                        if (conversation) {
                            setSelectedConversation(conversation);
                            await markConversationRead(conversation, user);
                        } else {
                            setSelectedConversation({
                                email: recipientEmail,
                                displayName: recipientEmail.split('@')[0],
                                messages: [],
                                latestMessage: null,
                                unreadCount: 0,
                                isSystem: false
                            });
                        }
                    }
                } else {
                    setSelectedConversation(prev => {
                        if (!prev) return prev;
                        const updated = conversationList.find(c => c.email === prev.email);
                        return updated || prev;
                    });
                }
            } catch (error) {
                console.error('Failed to load messages:', error);
            }
            if (isInitial) setIsLoading(false);
        };

        loadData(true);

        // Realtime: any insert/update to direct_messages triggers a refresh.
        // RLS should already scope the stream to rows this user can see; we
        // still guard client-side because the channel fires before RLS
        // filtering on some Supabase versions.
        //
        // We intentionally debounce: multiple events in a burst (e.g. when
        // the admin blasts this user's cohort) collapse into one refetch.
        let refreshTimer = null;
        const scheduleRefresh = () => {
            if (refreshTimer) return;
            refreshTimer = setTimeout(() => {
                refreshTimer = null;
                loadData(false);
            }, 250);
        };

        const relevant = (row) => {
            if (!currentUserRef?.email) return false;
            return (
                row?.sender_email === currentUserRef.email ||
                row?.recipient_email === currentUserRef.email
            );
        };

        const channel = supabase
            .channel('messages-page')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'direct_messages' },
                (payload) => {
                    if (relevant(payload.new)) scheduleRefresh();
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'direct_messages' },
                (payload) => {
                    if (relevant(payload.new) || relevant(payload.old)) scheduleRefresh();
                }
            )
            .subscribe();

        return () => {
            if (refreshTimer) clearTimeout(refreshTimer);
            supabase.removeChannel(channel);
        };
    }, []);

    // Mark every unread message in the conversation as read and ping the
    // global unread-count bus so the header badge updates immediately.
    const markConversationRead = async (conversation, user) => {
        const unreadMessages = conversation.messages.filter(m =>
            m.recipient_email === user.email && !m.is_read
        );
        if (unreadMessages.length === 0) return;

        for (const message of unreadMessages) {
            try {
                await DirectMessage.update(message.id, { is_read: true });
            } catch (error) {
                console.error('Failed to mark message as read:', error);
            }
        }
        setConversations(prev =>
            prev.map(c =>
                c.email === conversation.email
                    ? { ...c, unreadCount: 0, messages: c.messages.map(m => ({ ...m, is_read: true })) }
                    : c
            )
        );
        window.dispatchEvent(
            new CustomEvent('unread_counts_changed', { detail: { kind: 'messages' } })
        );
    };

    const selectConversation = async (conversation) => {
        setSelectedConversation(conversation);
        if (currentUser) await markConversationRead(conversation, currentUser);
    };

    const sendMessage = async () => {
        if (!selectedConversation || !newMessage.trim() || isSending) return;

        setIsSending(true);
        try {
            const messageContent = newMessage.trim();
            const message = await DirectMessage.create({
                sender_email: currentUser.email,
                recipient_email: selectedConversation.email,
                content: messageContent
            });
            await notifyNewMessage(selectedConversation.email, currentUser.email, currentUser.full_name, messageContent);

            setConversations(prev => {
                const existingIndex = prev.findIndex(c => c.email === selectedConversation.email);
                if (existingIndex >= 0) {
                    const updated = [...prev];
                    updated[existingIndex] = {
                        ...updated[existingIndex],
                        messages: [...updated[existingIndex].messages, message],
                        latestMessage: message
                    };
                    return updated.sort((a, b) => new Date(b.latestMessage.created_date) - new Date(a.latestMessage.created_date));
                } else {
                    return [{
                        email: selectedConversation.email,
                        displayName: selectedConversation.displayName,
                        messages: [message],
                        latestMessage: message,
                        unreadCount: 0,
                        isSystem: false
                    }, ...prev];
                }
            });

            setSelectedConversation(prev => ({
                ...prev,
                messages: [...prev.messages, message],
                latestMessage: message
            }));

            setNewMessage('');
        } catch (error) {
            console.error('Failed to send message:', error);
            toast({ title: "Failed to Send", description: "Failed to send message. Please try again.", variant: "destructive" });
        }
        setIsSending(false);
    };

    const filteredConversations = conversations.filter((c) => {
        const term = searchTerm.toLowerCase();
        if (!term) return true;
        const { displayName } = resolveProfile(c.email, profileMap);
        return (
            displayName.toLowerCase().includes(term) ||
            c.email.toLowerCase().includes(term)
        );
    });

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <LoadingSpinner message="Loading messages..." />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">
            <Seo title="Messages" description="Direct messages with fellow gecko breeders." path="/Messages" noIndex />
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                            <Mail className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-4xl font-bold text-slate-100">Messages</h1>
                    </div>
                    <PageSettingsPanel title="Message Settings">
                        <div>
                            <Label className="text-slate-300 text-sm mb-1 block">Preview Lines</Label>
                            <div className="flex gap-1">
                                {['1', '2', '3'].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setMsgPrefs({ previewLines: n })}
                                        className={`px-3 py-1 text-xs rounded ${msgPrefs.previewLines === n ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label className="text-slate-300 text-sm">Enter to Send</Label>
                            <Switch checked={msgPrefs.enterToSend} onCheckedChange={v => setMsgPrefs({ enterToSend: v })} />
                        </div>
                        <p className="text-[10px] text-slate-500">
                            {msgPrefs.enterToSend ? 'Press Enter to send, Shift+Enter for new line' : 'Press Shift+Enter to send'}
                        </p>
                    </PageSettingsPanel>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
                    {/* Conversation list ,  hidden on mobile when a conversation is open */}
                    <Card
                        className={`bg-slate-900 border-slate-800 ${
                            selectedConversation ? 'hidden lg:block' : 'block'
                        }`}
                    >
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg text-slate-100">Conversations</CardTitle>
                                <Button
                                    size="sm"
                                    onClick={openCompose}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 px-3"
                                >
                                    <Plus className="w-4 h-4 mr-1" />
                                    New
                                </Button>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <Input
                                    placeholder="Search conversations..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 bg-slate-950 border-slate-700 text-slate-100"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="max-h-[calc(100vh-350px)] overflow-y-auto">
                                {filteredConversations.length === 0 ? (
                                    <EmptyState
                                        icon={MessageSquare}
                                        title="No Conversations"
                                        message="No conversations yet"
                                    />
                                ) : (
                                    filteredConversations.map((conversation) => {
                                        const isActive = selectedConversation?.email === conversation.email;
                                        const { displayName, avatarUrl } = resolveProfile(
                                            conversation.email,
                                            profileMap
                                        );
                                        // Strip markdown emphasis from the
                                        // preview so broadcasts don't show
                                        // literal asterisks in the list.
                                        const previewText = (conversation.latestMessage?.content || '')
                                            .replace(/[*_`#>]/g, '')
                                            .replace(/\s+/g, ' ')
                                            .trim();
                                        return (
                                            <div
                                                key={conversation.email}
                                                onClick={() => selectConversation(conversation)}
                                                className={`p-4 border-b border-slate-800 cursor-pointer transition-colors ${
                                                    isActive ? 'bg-slate-800' : 'hover:bg-slate-800/60'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <img
                                                            src={avatarUrl}
                                                            alt=""
                                                            className="w-10 h-10 rounded-full object-cover shrink-0 bg-slate-800"
                                                            loading="lazy"
                                                        />
                                                        <div className="min-w-0">
                                                            <div className="font-medium text-slate-100 flex items-center gap-2">
                                                                <span className="truncate">{displayName}</span>
                                                                {conversation.isSystem && (
                                                                    <Badge variant="secondary" className="text-[10px] bg-slate-700 text-slate-200 border-slate-600 shrink-0">
                                                                        System
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            {conversation.latestMessage && (
                                                                <div className={`text-sm text-slate-400 max-w-[220px] ${msgPrefs.previewLines === '1' ? 'truncate' : msgPrefs.previewLines === '2' ? 'line-clamp-2' : 'line-clamp-3'}`}>
                                                                    {previewText.substring(0, 120)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                                        {conversation.latestMessage && (
                                                            <div className="text-xs text-slate-500">
                                                                {format(new Date(conversation.latestMessage.created_date), 'MMM d')}
                                                            </div>
                                                        )}
                                                        {conversation.unreadCount > 0 && (
                                                            <Badge className="bg-red-600 text-white text-[10px] font-bold">
                                                                {conversation.unreadCount}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Message view ,  hidden on mobile when no conversation selected */}
                    <div
                        className={`lg:col-span-2 ${
                            selectedConversation ? 'block' : 'hidden lg:block'
                        }`}
                    >
                        {selectedConversation ? (() => {
                            const headerProfile = resolveProfile(
                                selectedConversation.email,
                                profileMap
                            );
                            return (
                            <Card className="bg-slate-900 border-slate-800 h-full flex flex-col">
                                <CardHeader className="pb-4 border-b border-slate-800">
                                    <div className="flex items-center justify-between gap-3">
                                        <CardTitle className="flex items-center gap-3 text-slate-100 min-w-0">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedConversation(null)}
                                                aria-label="Back to conversations"
                                                className="lg:hidden -ml-1 p-1 rounded-md hover:bg-slate-800 text-slate-300"
                                            >
                                                <ArrowLeft className="w-5 h-5" />
                                            </button>
                                            <img
                                                src={headerProfile.avatarUrl}
                                                alt=""
                                                className="w-10 h-10 rounded-full object-cover bg-slate-800"
                                                loading="lazy"
                                            />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="truncate">{headerProfile.displayName}</span>
                                                    {selectedConversation.isSystem && (
                                                        <Badge variant="secondary" className="text-xs bg-slate-700 text-slate-200 border-slate-600">
                                                            System
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="text-sm font-normal text-slate-400 truncate">
                                                    {selectedConversation.email}
                                                </div>
                                            </div>
                                        </CardTitle>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    aria-label="Conversation actions"
                                                    className="p-2 rounded-md hover:bg-slate-800 text-slate-300 shrink-0"
                                                >
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700 text-slate-100">
                                                <DropdownMenuItem
                                                    onSelect={() => {
                                                        setIsSelectMode(true);
                                                        setSelectedIds(new Set());
                                                    }}
                                                    className="focus:bg-slate-800 cursor-pointer"
                                                >
                                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                                    Unsend recent messages
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardHeader>

                                <CardContent className="flex-1 p-0 flex flex-col">
                                    <div className="flex-1 overflow-y-auto p-4 max-h-[calc(100vh-450px)]">
                                        {annotateMessages(selectedConversation.messages).map(
                                            ({ message, showDateDivider, isFirstInGroup, isLastInGroup, date }) => {
                                            const isMine = message.sender_email === currentUser.email;
                                            const isSystem = message.message_type === 'system';
                                            // Bubble: cream, black text ,  the only element that
                                            // intentionally breaks the dark theme because the
                                            // user asked for it to be easier to read.
                                            const bubbleStyle = isMine
                                                ? {
                                                      backgroundColor: BUBBLE_OUTGOING_BG,
                                                      borderColor: BUBBLE_OUTGOING_BORDER,
                                                      color: BUBBLE_INK,
                                                  }
                                                : isSystem
                                                    ? {
                                                          backgroundColor: BUBBLE_SYSTEM_BG,
                                                          borderColor: BUBBLE_SYSTEM_BORDER,
                                                          color: BUBBLE_INK,
                                                      }
                                                    : {
                                                          backgroundColor: BUBBLE_INCOMING_BG,
                                                          borderColor: BUBBLE_INCOMING_BORDER,
                                                          color: BUBBLE_INK,
                                                      };
                                            // Spacing: more air before a new group, tight within.
                                            const wrapperSpacing = isFirstInGroup ? 'mt-4' : 'mt-0.5';
                                            // Rounded corners flatten on the sender side for
                                            // stacked bubbles so the cluster reads as one unit.
                                            let cornerClasses = 'rounded-2xl';
                                            if (!isFirstInGroup && !isLastInGroup) {
                                                cornerClasses = isMine ? 'rounded-2xl rounded-tr-md rounded-br-md' : 'rounded-2xl rounded-tl-md rounded-bl-md';
                                            } else if (!isFirstInGroup) {
                                                cornerClasses = isMine ? 'rounded-2xl rounded-tr-md' : 'rounded-2xl rounded-tl-md';
                                            } else if (!isLastInGroup) {
                                                cornerClasses = isMine ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-bl-md';
                                            }
                                            const isSelected = selectedIds.has(message.id);
                                            const unsendable = canUnsend(
                                                message,
                                                currentUser?.email,
                                                nowTick
                                            );
                                            // Countdown label shown on my own recent bubbles
                                            // so there's a visible cue that the unsend window
                                            // is ticking. Rendered as a second line beside
                                            // the send time in the bubble footer.
                                            const msLeft = unsendable
                                                ? UNSEND_WINDOW_MS -
                                                  (nowTick - new Date(message.created_date).getTime())
                                                : 0;
                                            const minutesLeft = Math.max(0, Math.ceil(msLeft / 60000));
                                            const unsendCountdown = unsendable
                                                ? minutesLeft <= 1
                                                    ? '< 1 min left to unsend'
                                                    : `${minutesLeft} min left to unsend`
                                                : null;
                                            return (
                                                <div key={message.id}>
                                                    {showDateDivider && (
                                                        <div className="flex items-center my-4">
                                                            <div className="flex-1 border-t border-slate-800" />
                                                            <span className="px-3 text-[11px] uppercase tracking-wide text-slate-500">
                                                                {formatDateDivider(date)}
                                                            </span>
                                                            <div className="flex-1 border-t border-slate-800" />
                                                        </div>
                                                    )}
                                                    <div
                                                        onClick={
                                                            isSelectMode && unsendable
                                                                ? () => toggleSelected(message.id)
                                                                : undefined
                                                        }
                                                        className={`flex items-center gap-2 ${isMine ? 'justify-end' : 'justify-start'} ${wrapperSpacing} ${
                                                            isSelectMode && unsendable ? 'cursor-pointer select-none' : ''
                                                        } ${isSelectMode && !unsendable ? 'opacity-70' : ''} ${
                                                            isSelected ? 'bg-emerald-900/20 -mx-4 px-4 py-1 rounded-md' : ''
                                                        }`}
                                                    >
                                                        <div
                                                            className={`max-w-xs lg:max-w-md px-4 py-2.5 border shadow-sm ${cornerClasses}`}
                                                            style={bubbleStyle}
                                                        >
                                                            <div className="prose prose-sm max-w-none text-sm leading-relaxed prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 prose-headings:font-semibold prose-a:text-emerald-700 prose-strong:text-inherit">
                                                                <ReactMarkdown>{message.content}</ReactMarkdown>
                                                            </div>
                                                            {(isLastInGroup || unsendCountdown) && (
                                                                <div
                                                                    className="text-[10px] mt-1 flex items-center gap-2 flex-wrap"
                                                                    style={{ color: BUBBLE_INK_MUTED }}
                                                                >
                                                                    {isLastInGroup && <span>{format(date, 'h:mm a')}</span>}
                                                                    {unsendCountdown && (
                                                                        <span className="italic">{unsendCountdown}</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {isSelectMode && isMine && unsendable && (
                                                            isSelected ? (
                                                                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                                            ) : (
                                                                <Circle className="w-5 h-5 text-slate-500 shrink-0" />
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={scrollAnchorRef} />
                                    </div>

                                    {isSelectMode ? (
                                        <div className="p-4 border-t border-slate-800 flex items-center justify-between gap-3">
                                            <div className="text-sm text-slate-300">
                                                {selectedIds.size} selected
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        setIsSelectMode(false);
                                                        setSelectedIds(new Set());
                                                    }}
                                                    className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                                                >
                                                    <X className="w-4 h-4 mr-2" />
                                                    Cancel
                                                </Button>
                                                <Button
                                                    onClick={deleteSelected}
                                                    disabled={selectedIds.size === 0 || isDeleting}
                                                    className="bg-red-600 hover:bg-red-500 text-white"
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Unsend ({selectedIds.size})
                                                </Button>
                                            </div>
                                        </div>
                                    ) : !selectedConversation.isSystem ? (
                                        <div className="p-4 border-t border-slate-800">
                                            <div className="flex gap-3">
                                                <Textarea
                                                    placeholder="Type your message..."
                                                    value={newMessage}
                                                    onChange={(e) => setNewMessage(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (msgPrefs.enterToSend && e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            sendMessage();
                                                        } else if (!msgPrefs.enterToSend && e.key === 'Enter' && e.shiftKey) {
                                                            e.preventDefault();
                                                            sendMessage();
                                                        }
                                                    }}
                                                    className="flex-1 resize-none bg-slate-950 border-slate-700 text-slate-100"
                                                    rows={2}
                                                />
                                                <Button
                                                    onClick={sendMessage}
                                                    disabled={!newMessage.trim() || isSending}
                                                    className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
                                                >
                                                    <Send className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ) : null}
                                </CardContent>
                            </Card>
                            );
                        })() : (
                            <Card className="bg-slate-900 border-slate-800 h-full flex items-center justify-center">
                                <EmptyState
                                    icon={MessageSquare}
                                    title="No Conversation Selected"
                                    message="Select a conversation to start messaging"
                                />
                            </Card>
                        )}
                    </div>
                </div>
            </div>

            <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
                <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>New Message</DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Pick someone to start a conversation with.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="relative mt-2">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                            autoFocus
                            placeholder="Search by name or email..."
                            value={composeSearch}
                            onChange={(e) => setComposeSearch(e.target.value)}
                            className="pl-10 bg-slate-950 border-slate-700 text-slate-100"
                        />
                    </div>
                    <div className="max-h-80 overflow-y-auto -mx-6 px-6">
                        {isLoadingProfiles && (
                            <div className="py-6 text-center text-sm text-slate-400">
                                Loading directory...
                            </div>
                        )}
                        {!isLoadingProfiles && allProfiles && (() => {
                            const term = composeSearch.trim().toLowerCase();
                            const results = allProfiles
                                .filter((p) => p.email && p.email !== currentUser?.email)
                                .filter((p) => {
                                    if (!term) return true;
                                    return (
                                        (p.full_name || '').toLowerCase().includes(term) ||
                                        p.email.toLowerCase().includes(term)
                                    );
                                })
                                .slice(0, 50);
                            if (results.length === 0) {
                                return (
                                    <div className="py-6 text-center text-sm text-slate-400">
                                        {term ? 'No matches.' : 'No users found.'}
                                    </div>
                                );
                            }
                            return results.map((profile) => {
                                const name = profile.full_name || profile.email.split('@')[0];
                                return (
                                    <button
                                        key={profile.email}
                                        type="button"
                                        onClick={() => startConversationWith(profile)}
                                        className="w-full flex items-center gap-3 py-2 px-2 rounded-md hover:bg-slate-800 text-left"
                                    >
                                        <img
                                            src={profile.profile_image_url || initialsAvatarUrl(name, 64)}
                                            alt=""
                                            className="w-9 h-9 rounded-full object-cover bg-slate-800 shrink-0"
                                            loading="lazy"
                                        />
                                        <div className="min-w-0">
                                            <div className="text-sm text-slate-100 truncate">{name}</div>
                                            <div className="text-xs text-slate-500 truncate">{profile.email}</div>
                                        </div>
                                    </button>
                                );
                            });
                        })()}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
