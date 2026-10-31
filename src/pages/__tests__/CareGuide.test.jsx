// @vitest-environment jsdom
// The Care Guide opens on Overview; its Handbook downloads as soon as the
// page has drawn, and the other Keeper's Guides when the browser is idle
// (src/components/careguide/keepersGuides.js). These tests check that a
// topic still opens together with its guide when the guide arrives in
// time, so the guide never appears late and pushes the topic down, and
// that topics without a guide open at once. A slow or failed download is
// covered in CareGuideSlowGuide.test.jsx. Only the network edges are
// stubbed.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';
import { HANDBOOK_GUIDE } from '@/data/keepers-guides/handbook';
import { SETUP_GUIDE } from '@/data/keepers-guides/setup';

vi.mock('@/entities/all', () => ({ CareGuideSection: { filter: async () => [] } }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));

import CareGuidePage from '@/pages/CareGuide';
import { GUIDE_SPACE, cachedGuideFor, hasKeepersGuide, loadGuideFor } from '@/components/careguide/keepersGuides';

installDomHarness();

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/CareGuide']}>
        <CareGuidePage />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

const topicHeading = (name) => screen.queryByRole('heading', { level: 2, name });
const SLOW = { timeout: 15000 };
const TEST_TIMEOUT = 30000;

describe('Care Guide Keeper\'s Guides', () => {
  it('knows which topics have a guide, and has none before any download', async () => {
    expect(cachedGuideFor('overview')).toBeNull();
    expect(hasKeepersGuide('overview')).toBe(true);
    expect(hasKeepersGuide('health')).toBe(false);
    expect(await loadGuideFor('health')).toBeNull();
    expect(cachedGuideFor('housing')).toBeNull();
  }, TEST_TIMEOUT);

  it('draws the page first, then fills the Handbook into its held space', async () => {
    renderPage();
    expect(topicHeading('Overview')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: HANDBOOK_GUIDE.title }, SLOW)).toBeTruthy();
    expect(cachedGuideFor('overview')).toBe(HANDBOOK_GUIDE);
    expect(GUIDE_SPACE.handbook).toMatch(/min-h-/);
  }, TEST_TIMEOUT);

  it('opens a topic together with its guide, never the topic first', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /^Housing/ }));
    // The moment Housing shows, its guide is already on screen with it.
    const heading = await screen.findByRole('heading', { level: 2, name: 'Housing' }, SLOW);
    expect(heading).toBeTruthy();
    expect(screen.getByRole('heading', { name: SETUP_GUIDE.title })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: HANDBOOK_GUIDE.title })).toBeNull();
    expect(cachedGuideFor('housing')).toBe(SETUP_GUIDE);
  }, TEST_TIMEOUT);

  it('opens a topic without a guide straight away', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /^Health/ }));
    expect(topicHeading('Health')).toBeTruthy();
    expect(screen.queryByText(/The Keeper's Guide Series/)).toBeNull();
  }, TEST_TIMEOUT);
});
