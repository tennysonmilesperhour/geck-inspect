// @vitest-environment jsdom
// The Keeper's Guides for Housing, Diet & Feeding and Breeding download
// after the Care Guide has drawn (src/components/careguide/keepersGuides.js).
// A topic waits for its guide so the two appear together, but only for
// about a second: on a slow phone connection the tap must still answer.
// These tests hold one guide's download open and make another fail, and
// check that the topic opens anyway, with the guide's space held until it
// arrives, and without a lingering placeholder when the download fails.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const gate = vi.hoisted(() => {
  let open;
  const opened = new Promise((resolve) => { open = resolve; });
  return { opened, open };
});

vi.mock('@/entities/all', () => ({ CareGuideSection: { filter: async () => [] } }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));
// Diet & Feeding's guide arrives only when the test opens the gate.
vi.mock('@/data/keepers-guides/feeding', async (importOriginal) => {
  await gate.opened;
  return importOriginal();
});
// Breeding's guide cannot download at all.
vi.mock('@/data/keepers-guides/breeding', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

import CareGuidePage from '@/pages/CareGuide';
import { GUIDE_SPACE, GUIDE_WAIT_MS } from '@/components/careguide/keepersGuides';

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

describe('Care Guide topics on a slow connection', () => {
  it('waits about a second at most', () => {
    expect(GUIDE_WAIT_MS).toBeGreaterThan(0);
    expect(GUIDE_WAIT_MS).toBeLessThanOrEqual(1000);
  });

  it('opens the topic after the wait with the guide\'s space held, and fills it when the guide arrives', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /^Diet & Feeding/ }));
    // The guide is held until the gate opens below, yet the topic opens
    // (it used to wait for the guide).
    expect(await screen.findByRole('heading', { level: 2, name: 'Diet & Feeding' }, SLOW)).toBeTruthy();
    expect(topicHeading('Overview')).toBeNull();

    const waiting = screen.getByRole('status');
    expect(waiting.textContent).toMatch(/Loading this topic's guide/);
    const box = waiting.closest('section');
    expect(box.getAttribute('aria-busy')).toBe('true');
    for (const cls of GUIDE_SPACE.feeding.split(' ')) expect(box.className).toContain(cls);

    gate.open();
    await waitFor(() => expect(document.getElementById('keepers-guide-series')).toBeTruthy(), SLOW);
    expect(screen.queryByText(/Loading this topic's guide/)).toBeNull();
    expect(topicHeading('Diet & Feeding')).toBeTruthy();
  }, TEST_TIMEOUT);

  it('opens the topic without its guide, and without a placeholder, when the download fails', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /^Breeding/ }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Breeding' }, SLOW)).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/Loading this topic's guide/)).toBeNull(), SLOW);
    expect(document.getElementById('keepers-guide-series')).toBeNull();
  }, TEST_TIMEOUT);
});
