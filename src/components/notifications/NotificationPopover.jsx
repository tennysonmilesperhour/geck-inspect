import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Bell, ArrowRight, Check, Award, Shield, ImagePlus, User as UserIcon, MessageSquare, Star, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNowStrict } from 'date-fns';

const ICONS = {
  level_up: <Award className="w-4 h-4 text-yellow-400" />,
  expert_status: <Shield className="w-4 h-4 text-green-400" />,
  submission_approved: <ImagePlus className="w-4 h-4 text-teal-400" />,
  role_change: <UserIcon className="w-4 h-4 text-blue-400" />,
  new_comment: <MessageSquare className="w-4 h-4 text-purple-400" />,
  new_reply: <MessageSquare className="w-4 h-4 text-indigo-400" />,
  new_message: <Bell className="w-4 h-4 text-pink-400" />,
  announcement: <Bell className="w-4 h-4 text-red-400" />,
  gecko_of_the_day_selection: <Star className="w-4 h-4 text-yellow-400" />,
  new_follower: <UserIcon className="w-4 h-4 text-emerald-400" />,
  new_gecko_listing: <Star className="w-4 h-4 text-blue-400" />,
  new_breeding_plan: <Star className="w-4 h-4 text-purple-400" />,
  future_breeding_ready: <Star className="w-4 h-4 text-emerald-400" />,
  marketplace_inquiry: <ShoppingCart className="w-4 h-4 text-amber-400" />,
  gecko_of_the_day: <Star className="w-4 h-4 text-yellow-400" />,
};

/**
 * Notification bell popover — shows the 5 most recent unread
 * notifications inline, with a "See all" link to the full page.
 */
export default function NotificationPopover({ notifications = [], unreadCount = 0, onMarkRead }) {
  const [open, setOpen] = useState(false);

  const recent = notifications.slice(0, 5);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="gecko-header-action"
        aria-label="Notifications"
      >
        <Bell />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border border-emerald-900/40 bg-slate-950 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-900/30">
              <h3 className="text-sm font-semibold text-slate-100">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            {/* List */}
            <div className="max-h-72 overflow-y-auto">
              {recent.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No new notifications</p>
                </div>
              ) : (
                recent.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-emerald-900/20 transition-colors ${
                      n.is_read ? 'opacity-60' : 'hover:bg-emerald-950/30'
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {ICONS[n.type] || <Bell className="w-4 h-4 text-slate-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-200 leading-snug line-clamp-2">
                        {n.content}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {n.created_date
                          ? formatDistanceToNowStrict(new Date(n.created_date), { addSuffix: true })
                          : ''}
                      </p>
                    </div>
                    {!n.is_read && onMarkRead && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkRead(n.id);
                        }}
                        className="shrink-0 mt-0.5 text-slate-500 hover:text-emerald-400 transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <Link
              to={createPageUrl('Notifications')}
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 border-t border-emerald-900/30 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 transition-colors"
            >
              See all notifications
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
