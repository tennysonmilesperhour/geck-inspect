import { RETIRED_PAGES } from '@/lib/retiredPages';

const PARENT_PAGE = {
  GeckoDetail: 'MyGeckos', ForumPost: 'Forum',
  MarketplaceBuy: 'Market', MarketplaceSell: 'Market',
  BatchHusbandry: 'Today', FieldMode: 'Today', log: 'Today',
};

export function notificationPage(notification) {
  const link = notification?.link;
  if (typeof link !== 'string' || !link.startsWith('/') || link.startsWith('//')) return null;
  let page = link.split(/[?#]/)[0].split('/')[1] || 'Dashboard';
  const retired = RETIRED_PAGES.find((entry) => entry.page === page);
  if (retired) page = retired.to.split(/[/?#]/)[1] || 'Dashboard';
  return PARENT_PAGE[page] || page;
}

export function countNavNotifications(notifications, email) {
  const counts = {};
  const seen = new Set();
  for (const notification of notifications || []) {
    if (!email || notification.user_email !== email || notification.is_read || seen.has(notification.id)) continue;
    if (notification.metadata?.quiet === true || notification.metadata?.quiet === 'true') continue;
    seen.add(notification.id);
    const page = notificationPage(notification);
    if (page) counts[page] = (counts[page] || 0) + 1;
  }
  return counts;
}
