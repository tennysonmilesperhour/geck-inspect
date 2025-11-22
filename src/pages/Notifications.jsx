
import React, { useState, useEffect } from 'react';
import { Notification } from '@/entities/Notification';
import { User } from '@/entities/User';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, MessageSquare, Award, User as UserIcon, Shield, Check, Trash2, ImagePlus, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const notificationIcons = {
    level_up: <Award className="w-5 h-5 text-yellow-500" />,
    expert_status: <Shield className="w-5 h-5 text-green-500" />,
    submission_approved: <ImagePlus className="w-5 h-5 text-teal-500" />,
    role_change: <UserIcon className="w-5 h-5 text-blue-500" />,
    new_comment: <MessageSquare className="w-5 h-5 text-purple-500" />,
    new_reply: <MessageSquare className="w-5 h-5 text-indigo-500" />,
    new_message: <Bell className="w-5 h-5 text-pink-500" />,
    announcement: <Bell className="w-5 h-5 text-red-500" />,
    gecko_of_the_day_selection: <Star className="w-5 h-5 text-yellow-500" />
};

const notificationColors = {
    level_up: "bg-yellow-100 text-yellow-800",
    expert_status: "bg-green-100 text-green-800",
    submission_approved: "bg-teal-100 text-teal-800",
    role_change: "bg-blue-100 text-blue-800",
    new_comment: "bg-purple-100 text-purple-800",
    new_reply: "bg-indigo-100 text-indigo-800",
    new_message: "bg-pink-100 text-pink-800",
    announcement: "bg-red-100 text-red-800",
    gecko_of_the_day_selection: "bg-yellow-100 text-yellow-800"
};

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);

    // Add delay and retry logic for API calls
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const retryApiCall = async (apiCall, maxRetries = 3, delayMs = 1000) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await apiCall();
            } catch (error) {
                if (error.response?.status === 429 && attempt < maxRetries) {
                    console.log(`Rate limit hit, retrying in ${delayMs * attempt}ms`);
                    await delay(delayMs * attempt);
                    continue;
                }
                throw error;
            }
        }
    };

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const currentUser = await retryApiCall(() => User.me());
                setUser(currentUser);
                const userNotifications = await retryApiCall(() => Notification.filter({ user_email: currentUser.email }, '-created_date'));
                setNotifications(userNotifications);
            } catch (error) {
                console.error("Failed to load notifications:", error);
                setUser(null);
            }
            setIsLoading(false);
        };
        loadData();
    }, []);

    const markAsRead = async (notificationId) => {
        try {
            await Notification.update(notificationId, { is_read: true });
            setNotifications(prev => 
                prev.map(notif => 
                    notif.id === notificationId ? { ...notif, is_read: true } : notif
                )
            );
        } catch (error) {
            console.error("Failed to mark as read:", error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const unreadNotifications = notifications.filter(n => !n.is_read);
            await Promise.all(
                unreadNotifications.map(notif => 
                    Notification.update(notif.id, { is_read: true })
                )
            );
            setNotifications(prev => 
                prev.map(notif => ({ ...notif, is_read: true }))
            );
        } catch (error) {
            console.error("Failed to mark all as read:", error);
        }
    };

    const deleteNotification = async (notificationId) => {
        try {
            await Notification.delete(notificationId);
            setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
        } catch (error) {
            console.error("Failed to delete notification:", error);
        }
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-sage-50 to-earth-50 p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <Card className="text-center py-12">
                        <CardContent>
                            <p className="text-lg text-sage-600">Please log in to view your notifications.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-sage-50 to-earth-50 p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center text-sage-600">Loading notifications...</div>
                </div>
            </div>
        );
    }

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-sage-50 to-earth-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                            <Bell className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-4xl font-bold text-sage-900">Notifications</h1>
                        {unreadCount > 0 && (
                            <Badge className="bg-red-500 text-white">
                                {unreadCount} unread
                            </Badge>
                        )}
                    </div>
                    <p className="text-lg text-sage-600">Stay updated with your activities and community interactions.</p>
                </div>

                {/* Actions */}
                {unreadCount > 0 && (
                    <div className="flex justify-end">
                        <Button onClick={markAllAsRead} variant="outline" className="flex items-center gap-2">
                            <Check className="w-4 h-4" />
                            Mark All as Read
                        </Button>
                    </div>
                )}

                {/* Notifications List */}
                <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
                    <CardContent className="p-6">
                        {notifications.length === 0 ? (
                            <div className="text-center py-12">
                                <Bell className="w-16 h-16 text-sage-400 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-sage-900 mb-2">No Notifications</h3>
                                <p className="text-sage-600">You're all caught up! New notifications will appear here.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={`flex items-start gap-4 p-4 rounded-lg border transition-all duration-200 ${
                                            notification.is_read 
                                                ? 'bg-sage-50 border-sage-200' 
                                                : 'bg-white border-blue-200 shadow-sm'
                                        }`}
                                    >
                                        <div className="flex-shrink-0 mt-1">
                                            {notificationIcons[notification.type]}
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge className={notificationColors[notification.type] || 'bg-gray-100 text-gray-800'}>
                                                            {notification.type.replace(/_/g, ' ')}
                                                        </Badge>
                                                        {!notification.is_read && (
                                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                                        )}
                                                    </div>
                                                    <p className="text-sage-800 mb-1">{notification.content}</p>
                                                    {notification.metadata?.report_content && (
                                                        <div 
                                                            className="mt-2 p-3 bg-sage-100 rounded-lg border border-sage-200 text-sm text-sage-700 prose max-w-none" 
                                                            dangerouslySetInnerHTML={{ __html: notification.metadata.report_content }}
                                                        />
                                                    )}
                                                    <p className="text-sm text-sage-500 mt-2">
                                                        {format(new Date(notification.created_date), "MMM d, yyyy 'at' h:mm a")}
                                                    </p>
                                                </div>
                                                
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {notification.link && (
                                                        <Button 
                                                            asChild
                                                            variant="ghost" 
                                                            size="sm"
                                                            onClick={() => markAsRead(notification.id)}
                                                        >
                                                            <Link to={notification.link}>
                                                                View
                                                            </Link>
                                                        </Button>
                                                    )}
                                                    {!notification.is_read && (
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm"
                                                            onClick={() => markAsRead(notification.id)}
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        onClick={() => deleteNotification(notification.id)}
                                                        className="text-red-600 hover:text-red-800"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
