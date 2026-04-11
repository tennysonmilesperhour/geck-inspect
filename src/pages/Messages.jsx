import React, { useState, useEffect } from 'react';
import { DirectMessage, User } from '@/entities/all';
import { notifyNewMessage } from '@/components/notifications/NotificationService';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Mail, Send, Search, User as UserIcon, MessageSquare } from 'lucide-react';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import { format } from 'date-fns';

/**
 * Messages page — light cream theme per the April 2026 UI pass.
 *
 * The rest of the app is dark slate, but the user specifically wanted
 * this surface to be cream with black text because reading long message
 * bodies on dark slate was tough. The whole page is wrapped in an
 * amber-cream background and all internal Cards use cream-50 with
 * slate-900 text. Bubbles use an amber tint for incoming and emerald
 * for outgoing so you can still tell them apart at a glance.
 */

const CREAM_BG = '#fdf8ed';
const CREAM_SURFACE = '#ffffff';
const CREAM_SURFACE_ALT = '#f8f1dc';
const INK = '#1a1a1a';
const INK_MUTED = '#5f5a4f';
const INK_FAINT = '#8a8577';
const AMBER_BORDER = '#e7dcc0';
const ACCENT = '#0f766e';

export default function MessagesPage() {
    const { toast } = useToast();
    const [currentUser, setCurrentUser] = useState(null);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);

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

                const allMessages = await DirectMessage.list('-created_date');

                const userMessages = allMessages.filter(m =>
                    m.sender_email === user.email || m.recipient_email === user.email
                );

                // Group into conversations keyed on the other participant
                const convMap = new Map();
                userMessages.forEach(message => {
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
                        displayName: email === 'system@geckinspect.com' ? 'Geck Inspect Team' : email.split('@')[0],
                        messages: msgs.sort((a, b) => new Date(a.created_date) - new Date(b.created_date)),
                        latestMessage,
                        unreadCount,
                        isSystem: email === 'system@geckinspect.com'
                    };
                });

                conversationList.sort((a, b) => new Date(b.latestMessage.created_date) - new Date(a.latestMessage.created_date));
                setConversations(conversationList);

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
        const interval = setInterval(() => loadData(false), 15000);
        return () => clearInterval(interval);
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

    const filteredConversations = conversations.filter(c =>
        c.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: CREAM_BG }}>
                <LoadingSpinner message="Loading messages..." />
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4 md:p-8" style={{ backgroundColor: CREAM_BG, color: INK }}>
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: ACCENT }}
                    >
                        <Mail className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold" style={{ color: INK }}>
                        Messages
                    </h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
                    {/* Conversation list */}
                    <Card
                        className="border shadow-sm"
                        style={{ backgroundColor: CREAM_SURFACE, borderColor: AMBER_BORDER }}
                    >
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg" style={{ color: INK }}>
                                Conversations
                            </CardTitle>
                            <div className="relative">
                                <Search
                                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
                                    style={{ color: INK_FAINT }}
                                />
                                <Input
                                    placeholder="Search conversations..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 border"
                                    style={{
                                        backgroundColor: CREAM_SURFACE_ALT,
                                        borderColor: AMBER_BORDER,
                                        color: INK,
                                    }}
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="max-h-[calc(100vh-350px)] overflow-y-auto">
                                {filteredConversations.length === 0 ? (
                                    <div className="p-8 text-center" style={{ color: INK_MUTED }}>
                                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                        <p className="text-sm font-medium">No conversations yet</p>
                                    </div>
                                ) : (
                                    filteredConversations.map((conversation) => {
                                        const isActive = selectedConversation?.email === conversation.email;
                                        return (
                                            <div
                                                key={conversation.email}
                                                onClick={() => selectConversation(conversation)}
                                                className="p-4 border-b cursor-pointer transition-colors"
                                                style={{
                                                    borderColor: AMBER_BORDER,
                                                    backgroundColor: isActive ? CREAM_SURFACE_ALT : 'transparent',
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!isActive) e.currentTarget.style.backgroundColor = '#fbf5e3';
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                                                }}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div
                                                            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                                                            style={{ backgroundColor: CREAM_SURFACE_ALT, color: INK_MUTED }}
                                                        >
                                                            <UserIcon className="w-5 h-5" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-semibold flex items-center gap-2" style={{ color: INK }}>
                                                                <span className="truncate">{conversation.displayName}</span>
                                                                {conversation.isSystem && (
                                                                    <Badge
                                                                        variant="secondary"
                                                                        className="text-[10px] shrink-0"
                                                                        style={{
                                                                            backgroundColor: '#f3e9cb',
                                                                            color: '#5a4a21',
                                                                            borderColor: '#e3d49f',
                                                                        }}
                                                                    >
                                                                        System
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            {conversation.latestMessage && (
                                                                <div className="text-sm truncate max-w-[220px]" style={{ color: INK_MUTED }}>
                                                                    {conversation.latestMessage.content.substring(0, 60)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                                        {conversation.latestMessage && (
                                                            <div className="text-xs" style={{ color: INK_FAINT }}>
                                                                {format(new Date(conversation.latestMessage.created_date), 'MMM d')}
                                                            </div>
                                                        )}
                                                        {conversation.unreadCount > 0 && (
                                                            <Badge
                                                                className="text-[10px] font-bold"
                                                                style={{ backgroundColor: '#b91c1c', color: '#fff' }}
                                                            >
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

                    {/* Message view */}
                    <div className="lg:col-span-2">
                        {selectedConversation ? (
                            <Card
                                className="border shadow-sm h-full flex flex-col"
                                style={{ backgroundColor: CREAM_SURFACE, borderColor: AMBER_BORDER }}
                            >
                                <CardHeader className="pb-4 border-b" style={{ borderColor: AMBER_BORDER }}>
                                    <CardTitle className="flex items-center gap-3" style={{ color: INK }}>
                                        <div
                                            className="w-10 h-10 rounded-full flex items-center justify-center"
                                            style={{ backgroundColor: CREAM_SURFACE_ALT, color: INK_MUTED }}
                                        >
                                            <UserIcon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate">{selectedConversation.displayName}</span>
                                                {selectedConversation.isSystem && (
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-xs"
                                                        style={{
                                                            backgroundColor: '#f3e9cb',
                                                            color: '#5a4a21',
                                                            borderColor: '#e3d49f',
                                                        }}
                                                    >
                                                        System
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="text-sm font-normal truncate" style={{ color: INK_MUTED }}>
                                                {selectedConversation.email}
                                            </div>
                                        </div>
                                    </CardTitle>
                                </CardHeader>

                                <CardContent className="flex-1 p-0 flex flex-col">
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[calc(100vh-450px)]">
                                        {selectedConversation.messages.map((message) => {
                                            const isMine = message.sender_email === currentUser.email;
                                            const bubbleStyle = isMine
                                                ? { backgroundColor: ACCENT, color: '#ffffff', borderColor: ACCENT }
                                                : message.message_type === 'system'
                                                    ? { backgroundColor: '#fff9e3', color: INK, borderColor: '#e3d49f' }
                                                    : { backgroundColor: CREAM_SURFACE_ALT, color: INK, borderColor: AMBER_BORDER };
                                            const timeStyle = isMine
                                                ? { color: 'rgba(255,255,255,0.8)' }
                                                : { color: INK_FAINT };
                                            return (
                                                <div
                                                    key={message.id}
                                                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                                                >
                                                    <div
                                                        className="max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl border shadow-sm"
                                                        style={bubbleStyle}
                                                    >
                                                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                                            {message.content}
                                                        </div>
                                                        <div className="text-[10px] mt-1" style={timeStyle}>
                                                            {format(new Date(message.created_date), 'MMM d, h:mm a')}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {!selectedConversation.isSystem && (
                                        <div className="p-4 border-t" style={{ borderColor: AMBER_BORDER }}>
                                            <div className="flex gap-3">
                                                <Textarea
                                                    placeholder="Type your message..."
                                                    value={newMessage}
                                                    onChange={(e) => setNewMessage(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            sendMessage();
                                                        }
                                                    }}
                                                    className="flex-1 resize-none border"
                                                    style={{
                                                        backgroundColor: CREAM_SURFACE_ALT,
                                                        borderColor: AMBER_BORDER,
                                                        color: INK,
                                                    }}
                                                    rows={2}
                                                />
                                                <Button
                                                    onClick={sendMessage}
                                                    disabled={!newMessage.trim() || isSending}
                                                    className="shrink-0 text-white"
                                                    style={{ backgroundColor: ACCENT }}
                                                >
                                                    <Send className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ) : (
                            <Card
                                className="border shadow-sm h-full flex items-center justify-center"
                                style={{ backgroundColor: CREAM_SURFACE, borderColor: AMBER_BORDER }}
                            >
                                <div className="p-8 text-center" style={{ color: INK_MUTED }}>
                                    <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
                                    <p className="text-base font-semibold mb-1" style={{ color: INK }}>
                                        No Conversation Selected
                                    </p>
                                    <p className="text-sm">Select a conversation to start messaging.</p>
                                </div>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
