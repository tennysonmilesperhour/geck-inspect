// @vitest-environment jsdom
// Messages page smoke test (plan item E3 30): the real page renders the
// member's inbox in jsdom, a reply is sent and shows in the thread, and a
// refused send says why and keeps what the member typed. Only the network
// edges are stubbed (Supabase, the entity layer, notifications).
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness, watchConsoleErrors } from '@/lib/__tests__/domHarness';

const ME = 'keeper@example.com';
const BREEDER = 'breeder@example.com';

const fx = vi.hoisted(() => ({
  rows: [],
  loadError: null,
  create: null,
  update: null,
  notify: null,
  subscribed: [],
}));

// A stand-in for the few Supabase calls the page makes: the inbox query,
// the display-name lookup and the realtime channel.
vi.mock('@/lib/supabaseClient', () => {
  const chain = (result) => {
    const q = {
      select: () => q,
      or: () => q,
      order: () => q,
      limit: () => Promise.resolve(result()),
      in: () => Promise.resolve(result()),
    };
    return q;
  };
  return {
    supabase: {
      from: () => chain(() => ({ data: fx.loadError ? null : fx.rows, error: fx.loadError })),
      rpc: () => chain(() => ({
        data: [{ id: 'p-breeder', email: BREEDER, full_name: 'Riley Breeder', profile_image_url: null }],
        error: null,
      })),
      channel: () => {
        const ch = { on: () => ch, subscribe: (cb) => { fx.subscribed.push(cb); return ch; } };
        return ch;
      },
      removeChannel: () => {},
    },
  };
});
vi.mock('@/entities/all', () => ({
  User: { me: async () => ({ id: 'u-me', email: ME, full_name: 'Sam Keeper' }) },
  DirectMessage: {
    create: (...args) => fx.create(...args),
    update: (...args) => fx.update(...args),
    filter: async () => [],
  },
}));
vi.mock('@/components/notifications/NotificationService', () => ({
  notifyNewMessage: (...args) => fx.notify(...args),
}));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-me', email: ME } }) }));

import MessagesPage from '@/pages/Messages';
import { Toaster } from '@/components/ui/toaster';

installDomHarness();

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <MessagesPage />
        <Toaster />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

async function openConversation(user) {
  await user.click(await screen.findByText('Riley Breeder'));
  return screen.findByPlaceholderText('Type your message...');
}

beforeEach(() => {
  window.history.replaceState(null, '', '/Messages');
  fx.rows = [
    {
      id: 'm1',
      sender_email: BREEDER,
      recipient_email: ME,
      content: 'Hi! The Lilly White female from the spring clutch is still available.',
      created_date: '2026-10-15T18:00:00.000Z',
      is_read: false,
    },
  ];
  fx.loadError = null;
  fx.subscribed = [];
  fx.create = vi.fn(async (data) => ({
    id: 'm2',
    ...data,
    created_date: '2026-10-16T09:00:00.000Z',
    is_read: false,
  }));
  fx.update = vi.fn(async (id, data) => ({ id, ...data }));
  fx.notify = vi.fn(async () => {});
});

describe('Messages page', () => {
  it('renders the inbox with the sender name, preview and unread count, with no React warnings', async () => {
    const errors = watchConsoleErrors();
    renderPage();
    expect(await screen.findByText('Riley Breeder')).toBeTruthy();
    expect(screen.getByText(/Lilly White female from the spring clutch/)).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(errors).toEqual([]);
  });

  it('opens a conversation, marks it read, and sends a reply that appears in the thread', async () => {
    const user = userEvent.setup();
    renderPage();
    const box = await openConversation(user);
    expect(fx.update).toHaveBeenCalledWith('m1', { is_read: true });

    await user.type(box, 'Yes please, can you send a photo of her fired up?');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(fx.create).toHaveBeenCalledWith({
      sender_email: ME,
      recipient_email: BREEDER,
      content: 'Yes please, can you send a photo of her fired up?',
    });
    expect(fx.notify).toHaveBeenCalledWith(BREEDER, ME, 'Sam Keeper');
    expect((await screen.findAllByText('Yes please, can you send a photo of her fired up?')).length).toBeGreaterThan(0);
    expect(box.value).toBe('');
  });

  it('says why a send was refused and keeps the typed message', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fx.create = vi.fn(async () => {
      throw Object.assign(new Error('too many new conversations'), { code: '54000' });
    });
    renderPage();
    const box = await openConversation(user);
    await user.type(box, 'Is she still available?');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    const title = await screen.findByText('Failed to Send');
    const toast = title.closest('li') || document.body;
    expect(within(toast).getByText(/started a lot of new conversations/)).toBeTruthy();
    expect(box.value).toBe('Is she still available?');
    expect(screen.getByRole('button', { name: 'Send message' }).hasAttribute('disabled')).toBe(false);
  });

  it('shows an empty inbox, not a broken page, when the inbox cannot load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fx.loadError = { message: 'network down' };
    renderPage();
    expect(await screen.findByText('No conversations yet')).toBeTruthy();
  });
});
