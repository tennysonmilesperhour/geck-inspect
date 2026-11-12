// @vitest-environment jsdom
// On phones the Messages icon is folded into the bell (experience review
// decision 6): the badge counts unread notifications plus unread messages,
// and the list opens with a Messages row. The laptop bell passes no
// message count and is unchanged.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';
import NotificationPopover from '@/components/notifications/NotificationPopover';

installDomHarness();

const notifications = [
  { id: 'n1', type: 'feeding_due', content: 'Feed Adults A', is_read: false },
  { id: 'n2', type: 'hatch_alert', content: 'An egg from Spud x Harley is due', is_read: false },
];

const renderBell = (props) => render(
  <MemoryRouter>
    <NotificationPopover notifications={notifications} unreadCount={2} {...props} />
  </MemoryRouter>,
);
const bell = () => screen.getByRole('button', { name: 'Notifications' });

describe('NotificationPopover', () => {
  it('counts only notifications when no message count is passed, and shows no Messages row', async () => {
    renderBell();
    expect(bell().textContent).toBe('2');
    await userEvent.click(bell());
    expect(screen.getByText('Feed Adults A')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Messages/ })).toBeNull();
  });

  it('adds unread messages to the badge and lists Messages first, linking to the inbox', async () => {
    renderBell({ unreadMessages: 3 });
    expect(bell().textContent).toBe('5');
    await userEvent.click(bell());
    const row = screen.getByRole('link', { name: /Messages/ });
    expect(row.getAttribute('href')).toBe('/Messages');
    expect(row.textContent).toContain('3 unread');
    // The row comes before the first notification.
    const first = screen.getByText('Feed Adults A');
    expect(row.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The "new" count in the heading stays the notifications' own.
    expect(screen.getByText('2 new')).toBeTruthy();
  });

  it('keeps the Messages row with nothing unread, and shows no badge when everything is read', async () => {
    render(<MemoryRouter><NotificationPopover notifications={[]} unreadCount={0} unreadMessages={0} /></MemoryRouter>);
    expect(bell().textContent).toBe('');
    await userEvent.click(bell());
    expect(screen.getByRole('link', { name: /Messages/ }).textContent).toContain('No unread');
    expect(screen.getByText('No new notifications')).toBeTruthy();
  });

  it('caps the badge at 99+', () => {
    renderBell({ unreadCount: 60, unreadMessages: 60 });
    expect(bell().textContent).toBe('99+');
  });
});
