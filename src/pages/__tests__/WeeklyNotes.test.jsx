// @vitest-environment jsdom
// Weekly Gecko Notes for visitors without an account: the sign-up form
// (WeeklyNotesSignup), the /WeeklyNotes page that confirms only when its
// button is pressed (mail scanners open every link), and the form showing
// up under the account prompt on the guide pages. Only the Supabase client
// is stubbed.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({
  rpc: [],
  invoke: [],
  rpcAnswer: () => ({ data: 'confirmed', error: null }),
  invokeAnswer: () => ({ data: { ok: true }, error: null }),
  auth: { user: null, isAuthenticated: false },
  events: [],
}));

vi.mock('@/lib/supabaseLazy', () => ({
  getSupabase: async () => ({
    rpc: (fn, args) => {
      fx.rpc.push({ fn, args });
      return Promise.resolve(fx.rpcAnswer(fn, args));
    },
    functions: {
      invoke: (name, opts) => {
        fx.invoke.push({ name, body: opts.body });
        return Promise.resolve(fx.invokeAnswer(name, opts));
      },
    },
  }),
}));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => fx.auth }));
vi.mock('@/lib/posthog', () => ({ captureEvent: (name, props) => fx.events.push({ name, props }) }));

import WeeklyNotes from '@/pages/WeeklyNotes';
import WeeklyNotesSignup from '@/components/public/WeeklyNotesSignup';
import ContentSignupPrompt from '@/components/public/ContentSignupPrompt';

installDomHarness();

function renderAt(path, node = <WeeklyNotes />) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
    </HelmetProvider>,
  );
}

beforeEach(() => {
  fx.rpc = [];
  fx.invoke = [];
  fx.events = [];
  fx.rpcAnswer = () => ({ data: 'confirmed', error: null });
  fx.invokeAnswer = () => ({ data: { ok: true }, error: null });
  fx.auth = { user: null, isAuthenticated: false };
});

describe('the sign-up form', () => {
  it('sends the address to subscribe-weekly-notes and says to check the inbox', async () => {
    const user = userEvent.setup();
    renderAt('/MorphGuide/lilly-white', <WeeklyNotesSignup source="morph_end" page="/MorphGuide/lilly-white" />);
    await user.type(screen.getByLabelText('Email address'), 'ana@example.com');
    await user.click(screen.getByRole('button', { name: 'Send me the notes' }));
    expect(await screen.findByText(/Check your inbox\. Tap the link in the email from Geck Inspect to confirm/)).toBeTruthy();
    expect(fx.invoke).toEqual([{ name: 'subscribe-weekly-notes', body: { email: 'ana@example.com', source: 'morph_end', website: '' } }]);
    // Analytics get the page and the prompt, never the address.
    expect(fx.events).toEqual([{ name: 'weekly_notes_signup_submitted', props: { source: 'morph_end', page: '/MorphGuide/lilly-white' } }]);
    expect(JSON.stringify(fx.events)).not.toContain('ana@');
    expect(screen.queryByRole('button', { name: 'Send me the notes' })).toBeNull();
  });

  it('says when the address was already emailed today', async () => {
    const user = userEvent.setup();
    fx.invokeAnswer = () => ({ data: { ok: true, recently_sent: true }, error: null });
    renderAt('/CareGuide', <WeeklyNotesSignup source="care_guide" />);
    await user.type(screen.getByLabelText('Email address'), 'ana@example.com');
    await user.click(screen.getByRole('button', { name: 'Send me the notes' }));
    expect(await screen.findByText(/We already emailed this address today/)).toBeTruthy();
  });

  it('shows the reason a refusal gives, and keeps the form', async () => {
    const user = userEvent.setup();
    fx.invokeAnswer = () => ({
      data: null,
      error: { message: 'non-2xx', context: { json: async () => ({ error: 'Too many sign-ups from this network in the last hour. Please try again later.' }) } },
    });
    renderAt('/CareGuide', <WeeklyNotesSignup source="care_guide" />);
    await user.type(screen.getByLabelText('Email address'), 'ana@example.com');
    await user.click(screen.getByRole('button', { name: 'Send me the notes' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Too many sign-ups from this network in the last hour. Please try again later.');
    expect(screen.getByRole('button', { name: 'Send me the notes' })).toBeTruthy();
    expect(fx.events).toEqual([]);
  });

  it('asks for an address before sending anything', async () => {
    const user = userEvent.setup();
    renderAt('/CareGuide', <WeeklyNotesSignup source="care_guide" />);
    await user.click(screen.getByRole('button', { name: 'Send me the notes' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Please enter your email.');
    expect(fx.invoke).toEqual([]);
  });
});

describe('/WeeklyNotes', () => {
  it('opening the emailed link changes nothing until the button is pressed', async () => {
    const user = userEvent.setup();
    renderAt('/WeeklyNotes?t=tok_ABC-123');
    expect(screen.getByRole('heading', { name: 'Confirm Weekly Gecko Notes' })).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fx.rpc).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Confirm my email' }));
    expect(await screen.findByRole('heading', { name: 'You are signed up' })).toBeTruthy();
    expect(fx.rpc).toEqual([{ fn: 'confirm_weekly_notes_signup', args: { p_token: 'tok_ABC-123' } }]);
  });

  it('an expired or old link offers the form for a new one', async () => {
    for (const [answer, heading] of [['expired', 'This link has expired'], ['invalid', 'This link does not work']]) {
      const user = userEvent.setup();
      fx.rpcAnswer = () => ({ data: answer, error: null });
      const view = renderAt('/WeeklyNotes?t=tok_old');
      await user.click(screen.getByRole('button', { name: 'Confirm my email' }));
      expect(await screen.findByRole('heading', { name: heading })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Send me the notes' })).toBeTruthy();
      view.unmount();
    }
  });

  it('an address with an account is pointed to Settings', async () => {
    const user = userEvent.setup();
    fx.rpcAnswer = () => ({ data: 'member', error: null });
    renderAt('/WeeklyNotes?t=tok_ABC-123');
    await user.click(screen.getByRole('button', { name: 'Confirm my email' }));
    expect(await screen.findByRole('heading', { name: 'You have a Geck Inspect account' })).toBeTruthy();
    expect(screen.getByText(/This address, or another spelling of it, belongs to an account/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open Settings' })).toBeTruthy();
  });

  it('an answer it does not know, or a failure, is an error, never a success', async () => {
    const user = userEvent.setup();
    fx.rpcAnswer = () => ({ data: 'surprise', error: null });
    renderAt('/WeeklyNotes?t=tok_ABC-123');
    await user.click(screen.getByRole('button', { name: 'Confirm my email' }));
    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeTruthy();
  });

  it('without a link it shows the form, and a signed-in member is sent to Settings instead', async () => {
    const view = renderAt('/WeeklyNotes');
    expect(screen.getByRole('heading', { name: 'Weekly Gecko Notes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send me the notes' })).toBeTruthy();
    view.unmount();
    fx.auth = { user: { email: 'sam@example.com' }, isAuthenticated: true };
    renderAt('/WeeklyNotes');
    expect(screen.queryByRole('button', { name: 'Send me the notes' })).toBeNull();
    expect(screen.getByText(/Weekly Gecko Notes come with your account/)).toBeTruthy();
  });
});

describe('under the account prompt on the guide pages', () => {
  // An observer that reports the prompt on screen as soon as it is watched.
  class OnScreen {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {
      this.callback([{ isIntersecting: true }]);
    }
    disconnect() {}
    unobserve() {}
  }
  const withObserver = async (Observer, run) => {
    const saved = [window.IntersectionObserver, globalThis.IntersectionObserver];
    window.IntersectionObserver = Observer;
    globalThis.IntersectionObserver = Observer;
    try {
      await run();
    } finally {
      [window.IntersectionObserver, globalThis.IntersectionObserver] = saved;
    }
  };

  it('waits until the prompt is on screen before loading', async () => {
    // The harness observer never reports anything on screen.
    renderAt('/CareGuide', <ContentSignupPrompt pageType="care_guide" ctaId="care_guide_feeding" headline="Log feedings" />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('button', { name: 'Send me the notes' })).toBeNull();
  });

  it('appears for signed-out visitors once the prompt is on screen, and not where a page turns it off', () => withObserver(OnScreen, async () => {
    const view = renderAt('/CareGuide', <ContentSignupPrompt pageType="care_guide" ctaId="care_guide_feeding" headline="Log feedings" />);
    expect(await screen.findByRole('button', { name: 'Send me the notes' })).toBeTruthy();
    view.unmount();
    renderAt('/MorphGuide/lilly-white', <ContentSignupPrompt pageType="morph" ctaId="morph_mid" notes={false} headline="Track it" />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('button', { name: 'Send me the notes' })).toBeNull();
  }));

  it('is not shown to signed-in members', () => withObserver(OnScreen, async () => {
    fx.auth = { user: { email: 'sam@example.com' }, isAuthenticated: true };
    renderAt('/CareGuide', <ContentSignupPrompt pageType="care_guide" ctaId="care_guide_feeding" headline="Log feedings" />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('button', { name: 'Send me the notes' })).toBeNull();
  }));
});
