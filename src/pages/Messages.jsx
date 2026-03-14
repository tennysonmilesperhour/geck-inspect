import React, { useState, useEffect } from 'react';
import { DirectMessage, User } from '@/entities/all';
import { notifyNewMessage } from '@/components/notifications/NotificationService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Mail, Send, Search, User as UserIcon, MessageSquare, Trash2 } from 'lucide-react';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import { format } from 'date-fns';

export default function MessagesPage() {
    const [messages, setMessages] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const user = await User.me();
                setCurrentUser(user);
                
                // Get ALL messages where user is sender OR recipient
                const allMessages = await DirectMessage.list('-created_date');
                
                // Filter messages for current user (both sent and received)
                const userMessages = allMessages.filter(m => 
                    m.sender_email === user.email || m.recipient_email === user.email
                );
                setMessages(userMessages);

                // Group by conversations
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
                        displayName: email === 'system@geckinspect.app' ? 'Geck Inspect Team' : email.split('@')[0],
                        messages: msgs.sort((a, b) => new Date(a.created_date) - new Date(b.created_date)),
                        latestMessage,
                        unreadCount,
                        isSystem: email === 'system@geckinspect.app'
                    };
                });

                conversationList.sort((a, b) => new Date(b.latestMessage.created_date) - new Date(a.latestMessage.created_date));
                setConversations(conversationList);

                // Check if we should auto-select a conversation from URL params
                const urlParams = new URLSearchParams(window.location.search);
                const recipientEmail = urlParams.get('recipient');
                if (recipientEmail) {
                    const conversation = conversationList.find(c => c.email === recipientEmail);
                    if (conversation) {
                        setSelectedConversation(conversation);
                        await selectConversation(conversation);
                    } else {
                        // Create new conversation
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

            } catch (error) {
                console.error('Failed to load messages:', error);
            }
            setIsLoading(false);
        };

        loadData();
    }, []);

    const selectConversation = async (conversation) => {
        setSelectedConversation(conversation);
        
        // Mark messages as read
        const unreadMessages = conversation.messages.filter(m => 
            m.recipient_email === currentUser.email && !m.is_read
        );
        
        for (const message of unreadMessages) {
            try {
                await DirectMessage.update(message.id, { is_read: true });
            } catch (error) {
                console.error('Failed to mark message as read:', error);
            }
        }

        // Update local state
        setConversations(prev => 
            prev.map(c => 
                c.email === conversation.email 
                    ? { ...c, unreadCount: 0, messages: c.messages.map(m => ({ ...m, is_read: true })) }
                    : c
            )
        );
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
            
            // Notify recipient of new message
            await notifyNewMessage(selectedConversation.email, currentUser.email, currentUser.full_name, messageContent);

            // Update conversations
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
                    // New conversation
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

            // Update selected conversation
            setSelectedConversation(prev => ({
                ...prev,
                messages: [...prev.messages, message],
                latestMessage: message
            }));

            setNewMessage('');

        } catch (error) {
            console.error('Failed to send message:', error);
            alert('Failed to send message. Please try again.');
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
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                        <Mail className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold text-slate-100">Messages</h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
                    {/* Conversation List */}
                    <Card className="bg-slate-900 border-slate-700">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg text-slate-100">Conversations</CardTitle>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    placeholder="Search conversations..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 bg-slate-800 border-slate-600 text-slate-100"
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
                                    filteredConversations.map((conversation) => (
                                        <div
                                            key={conversation.email}
                                            onClick={() => selectConversation(conversation)}
                                            className={`p-4 border-b border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors ${
                                                selectedConversation?.email === conversation.email ? 'bg-slate-800' : ''
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                                                        <UserIcon className="w-5 h-5 text-slate-300" />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-slate-100 flex items-center gap-2">
                                                            {conversation.displayName}
                                                            {conversation.isSystem && (
                                                                <Badge variant="secondary" className="text-xs bg-slate-600 text-slate-200">System</Badge>
                                                            )}
                                                        </div>
                                                        {conversation.latestMessage && (
                                                            <div className="text-sm text-slate-400 truncate max-w-48">
                                                                {conversation.latestMessage.content.substring(0, 50)}...
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    {conversation.latestMessage && (
                                                        <div className="text-xs text-slate-500">
                                                            {format(new Date(conversation.latestMessage.created_date), 'MMM d')}
                                                        </div>
                                                    )}
                                                    {conversation.unreadCount > 0 && (
                                                        <Badge className="bg-red-500 text-white text-xs">
                                                            {conversation.unreadCount}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Message View */}
                    <div className="lg:col-span-2">
                        {selectedConversation ? (
                            <Card className="bg-slate-900 border-slate-700 h-full flex flex-col">
                                <CardHeader className="pb-4 border-b border-slate-700">
                                    <CardTitle className="flex items-center gap-3 text-slate-100">
                                        <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                                            <UserIcon className="w-5 h-5 text-slate-300" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                {selectedConversation.displayName}
                                                {selectedConversation.isSystem && (
                                                    <Badge variant="secondary" className="text-xs bg-slate-600 text-slate-200">System</Badge>
                                                )}
                                            </div>
                                            <div className="text-sm font-normal text-slate-400">
                                                {selectedConversation.email}
                                            </div>
                                        </div>
                                    </CardTitle>
                                </CardHeader>
                                
                                <CardContent className="flex-1 p-0 flex flex-col">
                                    {/* Messages */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[calc(100vh-450px)]">
                                        {selectedConversation.messages.map((message) => (
                                            <div
                                                key={message.id}
                                                className={`flex ${message.sender_email === currentUser.email ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div
                                                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                                        message.sender_email === currentUser.email
                                                            ? 'bg-blue-600 text-white'
                                                            : message.message_type === 'system'
                                                            ? 'bg-slate-700 text-slate-100 border border-slate-600'
                                                            : 'bg-slate-800 text-slate-100'
                                                    }`}
                                                >
                                                    <div className="whitespace-pre-wrap">{message.content}</div>
                                                    <div className={`text-xs mt-1 ${
                                                        message.sender_email === currentUser.email ? 'text-blue-200' : 'text-slate-400'
                                                    }`}>
                                                        {format(new Date(message.created_date), 'MMM d, h:mm a')}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Message Input */}
                                    {!selectedConversation.isSystem && (
                                        <div className="p-4 border-t border-slate-700">
                                            <div className="flex gap-3">
                                                <Textarea
                                                    placeholder="Type your message..."
                                                    value={newMessage}
                                                    onChange={(e) => setNewMessage(e.target.value)}
                                                    onKeyPress={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            sendMessage();
                                                        }
                                                    }}
                                                    className="flex-1 resize-none bg-slate-800 border-slate-600 text-slate-100"
                                                    rows={2}
                                                />
                                                <Button 
                                                    onClick={sendMessage}
                                                    disabled={!newMessage.trim() || isSending}
                                                    className="bg-blue-600 hover:bg-blue-700"
                                                >
                                                    <Send className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="bg-slate-900 border-slate-700 h-full flex items-center justify-center">
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