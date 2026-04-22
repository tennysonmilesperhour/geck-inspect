import { format } from 'date-fns';

const groupSummaryTemplates = {
    hatch_reminder: (count) => `${count} eggs in your incubator are expected to hatch tomorrow`,
    egg_lay_reminder: (count) => `${count} geckos are expected to lay eggs tomorrow`,
    feeding_reminder: (count, notifications) => {
        const overdue = notifications.some(n => n.content?.includes('overdue'));
        return overdue
            ? `${count} reptiles are due or overdue for feeding`
            : `${count} reptiles are due for feeding`;
    },
    new_follower: (count) => `${count} new followers`,
    new_message: (count) => `${count} new messages`,
    new_gecko_listing: (count) => `${count} new gecko listings`,
    new_breeding_plan: (count) => `${count} new breeding plans`,
};

function getGroupKey(notification) {
    const metaType = notification.metadata?.type;
    const notifType = notification.type || 'unknown';
    const day = format(new Date(notification.created_date), 'yyyy-MM-dd');
    const link = notification.link || '';
    return `${notifType}::${metaType || notifType}::${link}::${day}`;
}

function getSummaryType(notification) {
    return notification.metadata?.type || notification.type || 'unknown';
}

export function groupNotifications(notifications) {
    const groupMap = new Map();
    const groupOrder = [];

    for (const notif of notifications) {
        const key = getGroupKey(notif);
        if (!groupMap.has(key)) {
            groupMap.set(key, []);
            groupOrder.push(key);
        }
        groupMap.get(key).push(notif);
    }

    return groupOrder.map((key) => {
        const items = groupMap.get(key);
        const first = items[0];
        const summaryType = getSummaryType(first);
        const templateFn = groupSummaryTemplates[summaryType];

        const hasUnread = items.some((n) => !n.is_read);
        const unreadCount = items.filter((n) => !n.is_read).length;

        if (items.length === 1) {
            return { kind: 'single', notification: first, key };
        }

        const summary = templateFn
            ? templateFn(items.length, items)
            : `${items.length} ${first.type?.replace(/_/g, ' ') || 'notifications'}`;

        return {
            kind: 'group',
            key,
            summary,
            link: first.link,
            type: first.type,
            metaType: summaryType,
            notifications: items,
            hasUnread,
            unreadCount,
            createdDate: first.created_date,
        };
    });
}
