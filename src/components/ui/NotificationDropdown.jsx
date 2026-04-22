import React, { useState, useEffect, useCallback } from 'react';
import { Notification } from '@/entities/all';
import { Bell, Check, ChevronRight, ChevronDown, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatDistanceToNow } from 'date-fns';
import { groupNotifications } from '@/utils/groupNotifications';

const NotificationDropdown = ({ user, unreadCount, setUnreadCount }) => {
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState(new Set());

    const loadNotifications = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const fetchedNotifications = await Notification.filter({ user_email: user.email }, '-created_date', 10);
            setNotifications(fetchedNotifications);
            const count = fetchedNotifications.filter(n => !n.is_read).length;
            setUnreadCount(count);
        } catch (error) {
            console.error("Failed to load notifications:", error);
        }
        setIsLoading(false);
    }, [user, setUnreadCount]);

    useEffect(() => {
        if (isOpen) {
            setExpandedGroups(new Set());
            loadNotifications();
            const interval = setInterval(loadNotifications, 15000);
            return () => clearInterval(interval);
        }
    }, [isOpen, loadNotifications]);

    const clearLayoutCache = () => {
        if (window.dataCache && user) {
            window.dataCache.clear(`notifications_${user.email}`);
        }
    };

    const handleMarkAsRead = async (notificationId) => {
        try {
            await Notification.update(notificationId, { is_read: true });
            setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
            clearLayoutCache();
        } catch (error) {
            console.error("Failed to mark notification as read:", error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            const unreadNotifications = notifications.filter(n => !n.is_read);
            for (const notif of unreadNotifications) {
                await Notification.update(notif.id, { is_read: true });
            }
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
            clearLayoutCache();
        } catch (error) {
            console.error("Failed to mark all notifications as read:", error);
        }
    };

    const toggleGroup = (key, e) => {
        e.preventDefault();
        e.stopPropagation();
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const grouped = groupNotifications(notifications);

    return (
        <div className="relative">
            <button onClick={() => setIsOpen(!isOpen)} className="relative p-2 rounded-full hover:bg-sage-200">
                <Bell className="w-5 h-5 text-sage-700" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                        {unreadCount}
                    </span>
                )}
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-sage-200 rounded-lg shadow-xl z-50">
                    <div className="p-3 flex justify-between items-center border-b border-sage-200">
                        <h3 className="font-semibold text-sage-800">Notifications</h3>
                        {notifications.some(n => !n.is_read) && (
                            <button onClick={handleMarkAllAsRead} className="text-xs text-blue-600 hover:underline">
                                Mark all as read
                            </button>
                        )}
                    </div>
                    {isLoading ? (
                        <div className="p-4 text-center text-sage-600">Loading...</div>
                    ) : notifications.length === 0 ? (
                        <div className="p-4 text-center text-sage-600">No notifications yet.</div>
                    ) : (
                        <div className="max-h-96 overflow-y-auto">
                            {grouped.map(entry => {
                                if (entry.kind === 'single') {
                                    const notif = entry.notification;
                                    return (
                                        <Link
                                            to={notif.link || '#'}
                                            key={entry.key}
                                            className={`block p-3 border-b border-sage-100 hover:bg-sage-50 ${!notif.is_read ? 'bg-blue-50' : ''}`}
                                            onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
                                        >
                                            <p className="text-sm text-sage-700">{notif.content}</p>
                                            <p className="text-xs text-sage-500 mt-1">
                                                {formatDistanceToNow(new Date(notif.created_date), { addSuffix: true })}
                                            </p>
                                        </Link>
                                    );
                                }

                                const isExpanded = expandedGroups.has(entry.key);
                                return (
                                    <div key={entry.key} className="border-b border-sage-100">
                                        <div
                                            className={`flex items-start gap-2 p-3 hover:bg-sage-50 ${entry.hasUnread ? 'bg-blue-50' : ''}`}
                                        >
                                            <button
                                                onClick={(e) => toggleGroup(entry.key, e)}
                                                className="shrink-0 mt-0.5 p-0.5 rounded hover:bg-sage-200 transition-colors"
                                            >
                                                {isExpanded ? (
                                                    <ChevronDown className="w-4 h-4 text-blue-600" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4 text-sage-400" />
                                                )}
                                            </button>
                                            <Link
                                                to={entry.link || '#'}
                                                className="flex-1 min-w-0"
                                                onClick={() => {
                                                    if (entry.hasUnread) {
                                                        entry.notifications
                                                            .filter(n => !n.is_read)
                                                            .forEach(n => handleMarkAsRead(n.id));
                                                    }
                                                }}
                                            >
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <Layers className="w-3 h-3 text-blue-500 shrink-0" />
                                                    <span className="text-[11px] font-medium text-blue-600">
                                                        {entry.notifications.length} notifications
                                                    </span>
                                                </div>
                                                <p className="text-sm font-medium text-sage-700">
                                                    {entry.summary}
                                                </p>
                                                <p className="text-xs text-sage-500 mt-1">
                                                    {formatDistanceToNow(new Date(entry.createdDate), { addSuffix: true })}
                                                </p>
                                            </Link>
                                        </div>
                                        {isExpanded && (
                                            <div className="bg-sage-50/50">
                                                {entry.notifications.map(notif => (
                                                    <Link
                                                        to={notif.link || '#'}
                                                        key={notif.id}
                                                        className={`block p-2.5 pl-10 border-t border-sage-100 hover:bg-sage-100 ${!notif.is_read ? 'bg-blue-50/50' : ''}`}
                                                        onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
                                                    >
                                                        <p className="text-xs text-sage-600">{notif.content}</p>
                                                        <p className="text-[10px] text-sage-400 mt-0.5">
                                                            {formatDistanceToNow(new Date(notif.created_date), { addSuffix: true })}
                                                        </p>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className="p-2 text-center border-t border-sage-200">
                        <Link to={createPageUrl("Notifications")} className="text-sm font-medium text-blue-600 hover:underline">
                            View all notifications
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationDropdown;
