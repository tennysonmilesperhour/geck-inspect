import { useState, useEffect, useMemo } from 'react';
import Seo from '@/components/seo/Seo';
import { Notification, User } from '@/entities/all';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PageSettingsPanel from '@/components/ui/PageSettingsPanel';
import usePageSettings from '@/hooks/usePageSettings';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
    ShoppingCart,
} from 'lucide-react';
import EmptyState from '../components/shared/EmptyState';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

/**
 * Notifications page — dark slate theme, matches the rest of the app.
 *
 * Each notification row has:
 *   - its icon/type badge + content + timestamp
 *   - a "Mark read" button (only for unread rows) that marks the row
 *     read WITHOUT navigating to the linked event. Fires
 *     'unread_counts_changed' so the Layout header badge updates
 *     immediately, which fixes the "red number doesn't go away" bug.
 *   - a separate link-out button that navigates to the triggering event
 *     if one was provided.
 *   - a delete button so users can clean up their feed.
 *
 * "Mark all as read" hits every unread row in parallel and then emits
 * the same event so the header badge clears without a page refresh.
 */

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
    marketplace_inquiry: <ShoppingCart className="w-5 h-5 text-amber-400" />,
    gecko_of_the_day: <Star className="w-5 h-5 text-yellow-400" />,
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
    marketplace_inquiry: 'Inquiry',
    gecko_of_the_day: 'Gecko of the Day',
};

export default function NotificationsPage() {
    const [notifPrefs, setNotifPrefs] = usePageSettings('notifications_prefs', {
        autoMarkRead: false,
        groupByType: false,
        showUnreadOnly: false,
    });
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);
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

                // Auto-mark-read on view
                if (notifPrefs.autoMarkRead) {
                    const unread = userNotifications.filter(n => !n.is_read);
                    if (unread.length > 0) {
                        Promise.all(unread.map(n => Notification.update(n.id, { is_read: true })))
                            .then(() => {
                                setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
                                emitCountChanged();
                            })
                            .catch((err) => console.error('Auto-mark-read failed:', err));
                    }
                }
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

    const displayNotifications = useMemo(() => {
        let list = notifPrefs.showUnreadOnly ? notifications.filter(n => !n.is_read) : notifications;
        if (notifPrefs.groupByType) {
            list = [...list].sort((a, b) => {
                if (a.type !== b.type) return (a.type || '').localeCompare(b.type || '');
                return new Date(b.created_date) - new Date(a.created_date);
            });
        }
        return list;
    }, [notifications, notifPrefs.showUnreadOnly, notifPrefs.groupByType]);

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
            <Seo title="Notifications" description="Stay updated with your gecko community activity." path="/Notifications" noIndex />
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shrink-0">
                            <Bell className="w-6 h-6 text-white" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-3xl md:text-4xl font-bold text-slate-100">
                                Notifications
                            </h1>
                            <p className="text-sm text-slate-400">
                                {unreadCount > 0
                                    ? `${unreadCount} unread — click "Mark read" to dismiss without opening.`
                                    : "You're all caught up."}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap">
                        <PageSettingsPanel title="Notification Settings">
                            <div className="flex items-center justify-between">
                                <Label className="text-slate-300 text-sm">Auto-mark as Read</Label>
                                <Switch checked={notifPrefs.autoMarkRead} onCheckedChange={v => setNotifPrefs({ autoMarkRead: v })} />
                            </div>
                            <p className="text-[10px] text-slate-500 -mt-1">Mark notifications read when you view them</p>
                            <div className="flex items-center justify-between">
                                <Label className="text-slate-300 text-sm">Group by Type</Label>
                                <Switch checked={notifPrefs.groupByType} onCheckedChange={v => setNotifPrefs({ groupByType: v })} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="text-slate-300 text-sm">Unread Only</Label>
                                <Switch checked={notifPrefs.showUnreadOnly} onCheckedChange={v => setNotifPrefs({ showUnreadOnly: v })} />
                            </div>
                        </PageSettingsPanel>
                        <Button
                            onClick={markAllAsRead}
                            disabled={unreadCount === 0}
                            variant="outline"
                            className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Check className="w-4 h-4 mr-1.5" />
                            Mark all read
                        </Button>
                    </div>
                </div>

                <Card className="bg-slate-900 border-slate-800">
                    <CardContent className="p-4 md:p-6">
                        {displayNotifications.length === 0 ? (
                            <EmptyState
                                icon={Bell}
                                title={notifPrefs.showUnreadOnly ? "No unread notifications" : "No notifications"}
                                message={notifPrefs.showUnreadOnly ? "Toggle 'Unread Only' off in settings to see all." : "New notifications will appear here."}
                            />
                        ) : (
                            <div className="space-y-2">
                                {displayNotifications.map((notification) => {
                                    const isUnread = !notification.is_read;
                                    return (
                                        <div
                                            key={notification.id}
                                            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
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
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
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
                                                <p className="text-sm text-slate-200 leading-relaxed">
                                                    {notification.content}
                                                </p>
                                                <p className="text-[11px] text-slate-500 mt-1">
                                                    {format(
                                                        new Date(notification.created_date),
                                                        "MMM d, yyyy 'at' h:mm a"
                                                    )}
                                                </p>
                                            </div>
                                            <div className="flex flex-col md:flex-row gap-1.5 shrink-0">
                                                {isUnread && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => markAsRead(notification.id)}
                                                        className="h-7 text-xs border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                                                    >
                                                        <Check className="w-3 h-3 mr-1" /> Read
                                                    </Button>
                                                )}
                                                {notification.link && (
                                                    <Link
                                                        to={notification.link}
                                                        onClick={() => isUnread && markAsRead(notification.id)}
                                                    >
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 text-xs border-emerald-600/40 bg-emerald-900/20 hover:bg-emerald-900/40 text-emerald-300"
                                                        >
                                                            <ExternalLink className="w-3 h-3 mr-1" /> View
                                                        </Button>
                                                    </Link>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleDelete(notification.id)}
                                                    className="h-7 w-7 p-0 text-slate-500 hover:text-rose-400"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
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
