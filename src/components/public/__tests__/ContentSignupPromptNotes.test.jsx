// @vitest-environment jsdom
// The Weekly Gecko Notes form is optional on the guide pages: if its file
// cannot load (a deploy swapped the files, a dropped connection), the
// account prompt still shows and nothing reaches the page's error screen.
import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));
vi.mock('@/components/public/WeeklyNotesSignup', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

import ContentSignupPrompt from '@/components/public/ContentSignupPrompt';

installDomHarness();

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

describe('ContentSignupPrompt when the notes form cannot load', () => {
  it('still shows the account prompt and no error', async () => {
    const saved = [window.IntersectionObserver, globalThis.IntersectionObserver];
    window.IntersectionObserver = OnScreen;
    globalThis.IntersectionObserver = OnScreen;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <HelmetProvider>
          <MemoryRouter initialEntries={['/CareGuide']}>
            <ContentSignupPrompt pageType="care_guide" ctaId="care_guide_feeding" headline="Log feedings" />
          </MemoryRouter>
        </HelmetProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(screen.getByRole('heading', { name: 'Log feedings' })).toBeTruthy();
      expect(screen.getByRole('link', { name: /Create a free account/ })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Send me the notes' })).toBeNull();
    } finally {
      [window.IntersectionObserver, globalThis.IntersectionObserver] = saved;
      errors.mockRestore();
    }
  });
});
