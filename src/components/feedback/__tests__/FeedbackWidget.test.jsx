// @vitest-environment jsdom
// Phones have no floating feedback button (experience review B2). The
// form opens from "Send feedback" in the More menu, which fires the
// `open_feedback` window event; the edge tab is for the md width and up.
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ created: [] }));

vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: { email: 'keeper@example.com' } }) }));
vi.mock('@/entities/all', () => ({
  SupportMessage: { create: vi.fn(async (row) => { fx.created.push(row); return row; }) },
}));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import FeedbackWidget from '@/components/feedback/FeedbackWidget';

installDomHarness();

describe('FeedbackWidget', () => {
  it('draws its edge tab from the md width up only', () => {
    render(<FeedbackWidget />);
    const tab = screen.getByRole('button', { name: 'Send feedback' });
    expect(tab.className).toMatch(/(^| )hidden md:flex( |$)/);
    expect(tab.hasAttribute('data-follows-bottom-bar')).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the same form on the open_feedback event, and sends it', async () => {
    render(<FeedbackWidget />);
    act(() => { window.dispatchEvent(new CustomEvent('open_feedback')); });
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Share your thoughts');

    await userEvent.type(screen.getByPlaceholderText('Tell us more…'), 'The weigh-in chart is great.');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(fx.created).toHaveLength(1);
    expect(fx.created[0]).toMatchObject({ user_email: 'keeper@example.com', body: 'The weigh-in chart is great.', source: 'feedback' });
  });
});
