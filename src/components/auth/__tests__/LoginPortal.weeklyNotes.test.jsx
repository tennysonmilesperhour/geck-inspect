// @vitest-environment jsdom
// The sign-up form's Weekly Gecko Notes box (decision of 18 Oct 2026,
// docs/planning/weekly-notes-2026-10.md section 1): ticked by default,
// unticked for a browser in the EEA or the UK, and its value travels in
// the sign-up metadata, where the database saves it as the member's
// choice. Only the sign-up call is stubbed, plus the region signal.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ region: false, signUps: [], toasts: [] }));

vi.mock('@/lib/analyticsConsent', async (importOriginal) => ({
  ...(await importOriginal()),
  regionNeedsConsent: () => fx.region,
}));
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signUp: async (args) => {
        fx.signUps.push(args);
        return { data: { user: { id: 'new', identities: [{ id: 'i1' }] } }, error: null };
      },
      signInWithPassword: async () => ({ error: null }),
      signInWithOAuth: async () => ({ data: {}, error: null }),
    },
  },
}));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: (t) => fx.toasts.push(t) }) }));
vi.mock('@/lib/revenuecat', () => ({ isNativePlatform: () => false, detectPlatform: () => 'web' }));
vi.mock('@/lib/firstGeckoFlow', () => ({ readPendingGecko: () => null }));
vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => false }));
vi.mock('@/lib/emailLinkAuth', () => ({ isPkceLinkFromAnotherBrowser: () => false, readEmailLink: () => null }));

import LoginPortal from '@/components/auth/LoginPortal';

installDomHarness();

const BOX = 'Send me Weekly Gecko Notes, one short crested gecko tip a week';

function renderAt(path = '/AuthPortal?mode=signup') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LoginPortal />
    </MemoryRouter>,
  );
}

async function signUp(user) {
  await user.type(screen.getByLabelText('Display name'), 'Sam Keeper');
  await user.type(screen.getByLabelText('Email'), 'sam@example.com');
  await user.type(screen.getByLabelText('Password'), 'lillywhite1');
  await user.click(screen.getByRole('button', { name: 'Create free account' }));
}

beforeEach(() => {
  fx.region = false;
  fx.signUps = [];
  fx.toasts = [];
});

describe('the sign-up form\'s Weekly Gecko Notes box', () => {
  it('is ticked by default outside the EEA and the UK, and a ticked box is sent', async () => {
    const user = userEvent.setup();
    renderAt();
    expect(screen.getByRole('checkbox', { name: BOX }).getAttribute('aria-checked')).toBe('true');
    await signUp(user);
    expect(fx.signUps).toHaveLength(1);
    expect(fx.signUps[0].options.data).toEqual({ full_name: 'Sam Keeper', weekly_notes_at_signup: true });
  });

  it('sends false when the member unticks it', async () => {
    const user = userEvent.setup();
    renderAt();
    await user.click(screen.getByRole('checkbox', { name: BOX }));
    expect(screen.getByRole('checkbox', { name: BOX }).getAttribute('aria-checked')).toBe('false');
    await signUp(user);
    expect(fx.signUps[0].options.data.weekly_notes_at_signup).toBe(false);
  });

  it('starts unticked in the EEA and the UK, and only a tick sends consent', async () => {
    fx.region = true;
    const user = userEvent.setup();
    renderAt();
    expect(screen.getByRole('checkbox', { name: BOX }).getAttribute('aria-checked')).toBe('false');
    await signUp(user);
    expect(fx.signUps[0].options.data.weekly_notes_at_signup).toBe(false);
  });

  it('in the EEA and the UK a member who ticks it sends true', async () => {
    fx.region = true;
    const user = userEvent.setup();
    renderAt();
    await user.click(screen.getByRole('checkbox', { name: BOX }));
    await signUp(user);
    expect(fx.signUps[0].options.data.weekly_notes_at_signup).toBe(true);
  });

  it('is only on the sign-up form, not on sign-in', () => {
    renderAt('/AuthPortal');
    expect(screen.queryByText(BOX)).toBeNull();
    expect(screen.getByText('Stay signed in')).toBeTruthy();
  });

  it('uses plain words with no dashes', () => {
    expect(BOX).not.toMatch(/[\u2012-\u2015\u2212]|-{2}/);
  });
});
