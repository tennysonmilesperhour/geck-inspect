import React, { useState, useEffect } from 'react';
import { Notification, User } from '@/entities/all';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Bell,
    MessageSquare,
    Award,
    User as UserIcon,
    Shield,
    Check,
    ImagePlus,
    Star,
    ExternalLink,
    Trash2,
    ChevronRight,
    ChevronDown,
    Layers,
} from 'lucide-react';
import EmptyState from '../components/shared/EmptyState';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { groupNotifications } from '@/utils/groupNotifications';

const notificationIcons = {
    level_up: <Award className="w-5 h-5 text-yellow-400" />,
    expert_status: <Shield className="w-5 h-5 text-green-400" />,
    submission_approved: <ImagePlus className="w-5 h-5 text-teal-400" />,
    role_change: <UserIcon className="w-5 h-5 text-blue-400" />,
    new_comment: <MessageSquare className="w-5 h-5 text-purple-400" />,
    new_reply: <MessageSquare className="w-5 h-5 text-indigo-400" />,
    new_message: <Bell className="w-5 h-5 text-pink-400" />,
    announcement: <Bell className="w-5 h-5 text-red-400" />,
    gecko_of_the_day_selection: <Star className="w-5 h-5 text-yellow-400" />,
    new_follower: <UserIcon className="w-5 h-5 text-emerald-400" />,
    new_gecko_listing: <Star className="w-5 h-5 text-blue-400" />,
    new_breeding_plan: <Star className="w-5 h-5 text-purple-400" />,
    future_breeding_ready: <Star className="w-5 h-5 text-emerald-400" />,
};

const typeLabels = {
    level_up: 'Level Up',
    expert_status: 'Expert Status',
    submission_approved: 'Approved',
    role_change: 'Role',
    new_comment: 'Comment',
    new_reply: 'Reply',
    new_message: 'Message',
    announcement: 'Announcement',
    gecko_of_the_day_selection: 'Gecko of the Day',
    new_follower: 'Follower',
    new_gecko_listing: 'New Listing',
    new_breeding_plan: 'Breeding',
    future_breeding_ready: 'Breeding Ready',
};

function NotificationActions({ isUnread, link, onMarkRead, onDelete, compact, groupLabel }) {
    const readLabel = groupLabel ? 'Read All' : 'Read';
    const viewLabel = groupLabel ? 'View All' : 'View';
    return (
        <div className="flex items-center gap-1 shrink-0">
            {isUnread && (
                <Button
                    size="sm"
                    variant="outline"
                    onClick={onMarkRead}
                    className="h-7 text-xs border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2"
                    title={readLabel}
                >
                    <Check className="w-3 h-3" />
                    {!compact && <span className="ml-1 hidden sm:inline">{readLabel}</span>}
                </Button>
            )}
            {link && (
                <Link to={link} onClick={() => isUnread && onMarkRead()}>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-emerald-600/40 bg-emerald-900/20 hover:bg-emerald-900/40 text-emerald-300 px-2"
                        title={viewLabel}
                    >
                        <ExternalLink className="w-3 h-3" />
                        {!compact && <span className="ml-1 hidden sm:inline">{viewLabel}</span>}
                    </Button>
                </Link>
            )}
            <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                className="h-7 w-7 p-0 text-slate-500 hover:text-rose-400"
                title="Delete"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </Button>
        </div>
    );
}

function SingleNotificationRow({ notification, markAsRead, handleDelete }) {
    const isUnread = !notification.is_read;
    return (
        <div
            className={`flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border transition-colors ${
                isUnread
                    ? 'bg-slate-800 border-emerald-500/30'
                    : 'bg-slate-800/40 border-slate-800 opacity-70'
            }`}
        >
            <div className="shrink-0 mt-0.5">
                {notificationIcons[notification.type] || (
                    <Bell className="w-5 h-5 text-slate-400" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <Badge
                            variant="outline"
                            className="text-[10px] uppercase tracking-wider border-slate-600 bg-slate-900 text-slate-300"
                        >
                            {typeLabels[notification.type] ||
                                notification.type?.replace(/_/g, ' ')}
                        </Badge>
                        {isUnread && (
                            <span className="w-2 h-2 bg-emerald-400 rounded-full shrink-0" />
                        )}
                    </div>
                    <div className="hidden sm:block">
                        <NotificationActions
                            isUnread={isUnread}
                            link={notification.link}
                            onMarkRead={() => markAsRead(notification.id)}
                            onDelete={() => handleDelete(notification.id)}
                        />
                    </div>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">
                    {notification.content}
                </p>
                <div className="flex items-center justify-between mt-1 gap-2">
                    <p className="text-[11px] text-slate-500">
                        {format(
                            new Date(notification.created_date),
                            "MMM d, yyyy 'at' h:mm a"
                        )}
                    </p>
                    <div className="sm:hidden">
                        <NotificationActions
                            isUnread={isUnread}
                            link={notification.link}
                            onMarkRead={() => markAsRead(notification.id)}
                            onDelete={() => handleDelete(notification.id)}
                            compact
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function GroupedNotificationRow({ group, markAsRead, handleDelete, expandedGroups, toggleGroup }) {
    const isExpanded = expandedGroups.has(group.key);

    const markGroupAsRead = async () => {
        const unread = group.notifications.filter((n) => !n.is_read);
        for (const n of unread) {
            await markAsRead(n.id);
        }
    };

    const deleteGroup = async () => {
        for (const n of group.notifications) {
            await handleDelete(n.id);
        }
    };

    return (
        <div className="space-y-0">
            <div
                className={`flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border transition-colors ${
                    group.hasUnread
                        ? 'bg-slate-800 border-emerald-500/30'
                        : 'bg-slate-800/40 border-slate-800 opacity-70'
                } ${isExpanded ? 'rounded-b-none border-b-0' : ''}`}
            >
                <button
                    onClick={() => toggleGroup(group.key)}
                    className="shrink-0 mt-0.5 p-0.5 rounded hover:bg-slate-700 transition-colors"
                >
                    {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-emerald-400" />
                    ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                    )}
                </button>
                <div className="shrink-0 mt-0.5 hidden sm:block">
                    {notificationIcons[group.type] || (
                        <Bell className="w-5 h-5 text-slate-400" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <Badge
                                variant="outline"
                                className="text-[10px] uppercase tracking-wider border-slate-600 bg-slate-900 text-slate-300"
                            >
                                {typeLabels[group.type] ||
                                    group.type?.replace(/_/g, ' ')}
                            </Badge>
                            <Badge
                                variant="outline"
                                className="text-[10px] border-emerald-600/40 bg-emerald-900/20 text-emerald-300"
                            >
                                <Layers className="w-2.5 h-2.5 mr-0.5" />
                                {group.notifications.length}
                            </Badge>
                            {group.hasUnread && (
                                <span className="w-2 h-2 bg-emerald-400 rounded-full shrink-0" />
                            )}
                        </div>
                        <div className="hidden sm:block">
                            <NotificationActions
                                isUnread={group.hasUnread}
                                link={group.link}
                                onMarkRead={markGroupAsRead}
                                onDelete={deleteGroup}
                                groupLabel
                            />
                        </div>
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed font-medium">
                        {group.summary}
                    </p>
                    <div className="flex items-center justify-between mt-1 gap-2">
                        <p className="text-[11px] text-slate-500">
                            {format(
                                new Date(group.createdDate),
                                "MMM d, yyyy 'at' h:mm a"
                            )}
                        </p>
                        <div className="sm:hidden">
                            <NotificationActions
                                isUnread={group.hasUnread}
                                link={group.link}
                                onMarkRead={markGroupAsRead}
                                onDelete={deleteGroup}
                                compact
                                groupLabel
                            />
                        </div>
                    </div>
                </div>
            </div>
            {isExpanded && (
                <div
                    className={`border border-t-0 rounded-b-lg overflow-hidden ${
                        group.hasUnread ? 'border-emerald-500/30' : 'border-slate-800'
                    }`}
                >
                    {group.notifications.map((notification) => {
                        const isUnread = !notification.is_read;
                        return (
                            <div
                                key={notification.id}
                                className={`flex items-start gap-2 p-2.5 sm:p-3 pl-8 sm:pl-12 border-t transition-colors ${
                                    isUnread
                                        ? 'bg-slate-800/60 border-slate-700/50'
                                        : 'bg-slate-800/20 border-slate-800 opacity-70'
                                }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-300 leading-relaxed">
                                        {notification.content}
                                    </p>
                                    <div className="flex items-center justify-between mt-1 gap-2">
                                        <p className="text-[11px] text-slate-500">
                                            {format(
                                                new Date(notification.created_date),
                                                "MMM d, yyyy 'at' h:mm a"
                                            )}
                                        </p>
                                        <NotificationActions
                                            isUnread={isUnread}
                                            link={notification.link}
                                            onMarkRead={() => markAsRead(notification.id)}
                                            onDelete={() => handleDelete(notification.id)}
                                            compact
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState(new Set());
    const { toast } = useToast();

    useEffect(() => {
        (async () => {
            setIsLoading(true);
            try {
                const currentUser = await User.me();
                setUser(currentUser);
                if (!currentUser) {
                    setNotifications([]);
                    return;
                }
                const userNotifications = await Notification.filter(
                    { user_email: currentUser.email },
                    '-created_date'
                );
                setNotifications(userNotifications);
            } catch (error) {
                console.error('Failed to load notifications:', error);
                setUser(null);
            }
            setIsLoading(false);
        })();
    }, []);

    const emitCountChanged = () => {
        window.dispatchEvent(
            new CustomEvent('unread_counts_changed', { detail: { kind: 'notifications' } })
        );
    };

    const markAsRead = async (notificationId) => {
        try {
            await Notification.update(notificationId, { is_read: true });
            setNotifications((prev) =>
                prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
            );
            emitCountChanged();
        } catch (error) {
            console.error('Failed to mark as read:', error);
            toast({ title: 'Error', description: 'Could not mark as read.', variant: 'destructive' });
        }
    };

    const markAllAsRead = async () => {
        const unread = notifications.filter((n) => !n.is_read);
        if (unread.length === 0) return;
        try {
            await Promise.all(
                unread.map((notif) => Notification.update(notif.id, { is_read: true }))
            );
            setNotifications((prev) => prev.map((notif) => ({ ...notif, is_read: true })));
            emitCountChanged();
            toast({ title: 'All caught up', description: `${unread.length} notifications marked read.` });
        } catch (error) {
            console.error('Failed to mark all as read:', error);
            toast({ title: 'Error', description: 'Could not mark all as read.', variant: 'destructive' });
        }
    };

    const handleDelete = async (notificationId) => {
        try {
            await Notification.delete(notificationId);
            setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
            emitCountChanged();
        } catch (error) {
            console.error('Failed to delete notification:', error);
            toast({ title: 'Error', description: 'Could not delete.', variant: 'destructive' });
        }
    };

    const toggleGroup = (groupKey) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupKey)) {
                next.delete(groupKey);
            } else {
                next.add(groupKey);
            }
            return next;
        });
    };

    const grouped = groupNotifications(notifications);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 p-4 md:p-8">
                <div className="max-w-4xl mx-auto text-center text-slate-400 py-20">
                    Loading notifications...
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-slate-950 p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <Card className="text-center py-12 bg-slate-900 border-slate-800">
                        <CardContent>
                            <p className="text-lg text-slate-400">
                                Please log in to view your notifications.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between gap-2 sm:gap-4">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shrink-0">
                            <Bell className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-slate-100">
                                Notifications
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-400 truncate">
                                {unreadCount > 0
                                    ? `${unreadCount} unread`
                                    : "You're all caught up."}
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={markAllAsRead}
                        disabled={unreadCount === 0}
                        variant="outline"
                        className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm"
                    >
                        <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="ml-1 hidden sm:inline">Mark all read</span>
                        <span className="ml-1 sm:hidden">All read</span>
                    </Button>
                </div>

                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-4 md:p-6">
                        {grouped.length === 0 ? (
                            <EmptyState
                                icon={Bell}
                                title="No notifications"
                                message="New notifications will appear here."
                            />
                        ) : (
                            <div className="space-y-2">
                                {grouped.map((entry) => {
                                    if (entry.kind === 'single') {
                                        return (
                                            <SingleNotificationRow
                                                key={entry.key}
                                                notification={entry.notification}
                                                markAsRead={markAsRead}
                                                handleDelete={handleDelete}
                                            />
                                        );
                                    }
                                    return (
                                        <GroupedNotificationRow
                                            key={entry.key}
                                            group={entry}
                                            markAsRead={markAsRead}
                                            handleDelete={handleDelete}
                                            expandedGroups={expandedGroups}
                                            toggleGroup={toggleGroup}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
