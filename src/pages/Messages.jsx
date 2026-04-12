import React, { useState, useEffect } from 'react';
import { DirectMessage, User } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
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
 * Messages page — dark slate shell to match the rest of the app, but
 * the individual message bubbles themselves use a cream background
 * with black ink so long message bodies are easy to read. Only the
 * bubbles get recolored; the page background, conversation list, and
 * composer stay on the app's standard dark theme.
 */

// Bubble color tokens — kept inline so we don't have to extend Tailwind.
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

                // Server-side filter: only fetch messages involving this user.
                const { data: userMessages, error: msgError } = await supabase
                    .from('direct_messages')
                    .select('*')
                    .or(`sender_email.eq.${user.email},recipient_email.eq.${user.email}`)
                    .order('created_date', { ascending: false })
                    .limit(500);

                if (msgError) throw msgError;

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
        // Poll every 60s instead of 15s to reduce server load.
        // TODO: Replace with Supabase Realtime channel for instant updates.
        const interval = setInterval(() => loadData(false), 60000);
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
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <LoadingSpinner message="Loading messages..." />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                        <Mail className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold text-slate-100">Messages</h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
                    {/* Conversation list */}
                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg text-slate-100">Conversations</CardTitle>
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
                                                        <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center shrink-0">
                                                            <UserIcon className="w-5 h-5 text-slate-400" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-medium text-slate-100 flex items-center gap-2">
                                                                <span className="truncate">{conversation.displayName}</span>
                                                                {conversation.isSystem && (
                                                                    <Badge variant="secondary" className="text-[10px] bg-slate-700 text-slate-200 border-slate-600 shrink-0">
                                                                        System
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            {conversation.latestMessage && (
                                                                <div className="text-sm text-slate-400 truncate max-w-[220px]">
                                                                    {conversation.latestMessage.content.substring(0, 60)}
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

                    {/* Message view */}
                    <div className="lg:col-span-2">
                        {selectedConversation ? (
                            <Card className="bg-slate-900 border-slate-800 h-full flex flex-col">
                                <CardHeader className="pb-4 border-b border-slate-800">
                                    <CardTitle className="flex items-center gap-3 text-slate-100">
                                        <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center">
                                            <UserIcon className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate">{selectedConversation.displayName}</span>
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
                                </CardHeader>

                                <CardContent className="flex-1 p-0 flex flex-col">
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[calc(100vh-450px)]">
                                        {selectedConversation.messages.map((message) => {
                                            const isMine = message.sender_email === currentUser.email;
                                            const isSystem = message.message_type === 'system';
                                            // Bubble: cream, black text — the only element that
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
                                                        <div
                                                            className="text-[10px] mt-1"
                                                            style={{ color: BUBBLE_INK_MUTED }}
                                                        >
                                                            {format(new Date(message.created_date), 'MMM d, h:mm a')}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {!selectedConversation.isSystem && (
                                        <div className="p-4 border-t border-slate-800">
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
                                    )}
                                </CardContent>
                            </Card>
                        ) : (
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
        </div>
    );
}
