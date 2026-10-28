// @vitest-environment jsdom
// Morph ID on the photo path of the guided first gecko (28 Oct 2026), in
// jsdom with the real page, the real permission rule (src/lib/aiConsent.js)
// and the real Morph ID call (src/functions/recognizeGeckoMorph.js). Only
// Supabase, analytics and the heavy result panels are stubbed.
//
// What it pins:
// - the permission step is on the page, never the browser's confirm box
//   (unreliable in the iPhone app), and Morph ID is never called without a
//   yes; the yes covers a retry of the same photos and not new photos;
// - the "used this month's free Morph ID" card does not sit on top of the
//   result a free member just got (the scans-left refresh used to flip the
//   lock before the answer showed);
// - a member who came from the first gecko starter gets "Add this gecko"
//   directly under the result, ahead of the evidence; others keep it after.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({
  user: null,
  remaining: 1,
  invoke: null,
  captureEvent: null,
  upgradePromptShown: null,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    rpc: async (name) => (name === 'morph_id_scans_remaining'
      ? { data: { remaining: fx.remaining, bonus: 0 }, error: null }
      : { data: null, error: null }),
    functions: { invoke: (...args) => fx.invoke(...args) },
  },
}));
vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: fx.user, isGuest: false, isLoadingAuth: false }),
}));
vi.mock('@/lib/posthog', () => ({ captureEvent: (...args) => fx.captureEvent(...args) }));
vi.mock('@/lib/upgradePrompt', () => ({ upgradePromptShown: (...args) => fx.upgradePromptShown(...args) }));
vi.mock('@/lib/morphIdWarmup', () => ({ warmMorphId: () => {} }));
vi.mock('@/components/seo/Seo', () => ({ default: () => null }));
vi.mock('@/components/subscription/UpgradePlansButton', () => ({
  default: ({ children }) => <button type="button">{children}</button>,
}));
// The uploader is stood in by two buttons that report two finished sets
// of top and side photos, as the real one does once both are uploaded.
vi.mock('@/components/morph-id/ViewPhotoUploader', () => ({
  default: ({ onChange }) => (
    <div>
      <button type="button" onClick={() => onChange({ urls: ['https://cdn.test/top-a.jpg', 'https://cdn.test/side-a.jpg'], ready: true })}>
        Use photo set A
      </button>
      <button type="button" onClick={() => onChange({ urls: ['https://cdn.test/top-b.jpg', 'https://cdn.test/side-b.jpg'], ready: true })}>
        Use photo set B
      </button>
    </div>
  ),
}));
vi.mock('@/components/morph-id/MorphCorrectionPanel', () => ({
  default: ({ result }) => <section data-testid="morph-result">Result: {result.primary_morph}</section>,
}));
vi.mock('@/components/morph-id/SimilarGeckosStrip', () => ({ default: () => null }));
vi.mock('@/components/morph-id/MorphShareCard', () => ({ default: () => null, MyMorphShares: () => null }));
vi.mock('@/components/morph-id/PhotoSlideshow', () => ({ default: () => null }));
vi.mock('@/components/morph-id/PhotoTipsCard', () => ({ default: () => null }));
vi.mock('@/components/morph-id/MorphIdCoverageCard', () => ({ default: () => null }));
vi.mock('@/components/morph-id/MorphIdLimitsCard', () => ({ default: () => null }));

import Recognition from '@/pages/Recognition';

installDomHarness();

// A Lilly White on a harlequin base: Morph ID leads with "Lilly White".
const ANALYSIS = {
  primary_morph: 'harlequin',
  genetic_traits: ['lily_white'],
  secondary_traits: [],
  base_color: 'cream',
  assessment_status: 'identified',
  model_signal: 0.8,
};
const OK = { data: { analysis: ANALYSIS, tier: 'free', credits_remaining: 0 }, error: null };

function MyGeckosStub() {
  const location = useLocation();
  return <p data-testid="my-geckos">draft morph: {location.state?.geckoDraft?.morphs_traits}</p>;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/Recognition']}>
        <Routes>
          <Route path="/Recognition" element={<Recognition />} />
          <Route path="/MyGeckos" element={<MyGeckosStub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const morphIdCalls = () => fx.invoke.mock.calls.filter(([name]) => name === 'recognize-gecko-morph');

async function choosePhotos(user, set = 'A') {
  await user.click(await screen.findByRole('button', { name: `Use photo set ${set}` }));
}

async function identify(user) {
  await user.click(screen.getByRole('button', { name: /Identify morph/ }));
}

beforeEach(() => {
  window.history.replaceState(null, '', '/Recognition');
  fx.user = { id: 'p1', auth_user_id: 'auth-1', email: 'sam@example.com', role: 'user', membership_tier: 'free' };
  fx.remaining = 1;
  fx.captureEvent = vi.fn();
  fx.upgradePromptShown = vi.fn();
  // The server takes the scan as it answers, so the next scans-left read is 0.
  fx.invoke = vi.fn(async () => {
    fx.remaining = 0;
    return OK;
  });
  // The iPhone app's web view may not show a confirm box at all. The page
  // must never rely on one.
  window.confirm = vi.fn(() => {
    throw new Error('window.confirm must not be used on Morph ID');
  });
});

describe('Morph ID permission step', () => {
  it('asks on the page, and sends nothing without a yes', async () => {
    const user = userEvent.setup();
    renderPage();
    await choosePhotos(user);
    await identify(user);

    const panel = screen.getByRole('region', { name: 'Before we send your photos' });
    expect(panel.textContent).toContain('Anthropic');
    expect(panel.textContent).toContain('Replicate');
    expect(panel.textContent).toContain('permission to share');
    expect(fx.invoke).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('region', { name: 'Before we send your photos' })).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Nothing was sent and no scan was used');
    expect(fx.invoke).not.toHaveBeenCalled();
    expect(fx.captureEvent).toHaveBeenCalledWith('morph_id_consent', expect.objectContaining({ action: 'declined' }));
    expect(fx.captureEvent).toHaveBeenCalledWith('morph_id_result', expect.objectContaining({ outcome: 'error', error_code: 'ai_consent_declined' }));

    // Asking again after "Not now" shows the step again; the yes sends.
    await identify(user);
    await user.click(screen.getByRole('button', { name: /Allow and identify/ }));
    await screen.findByTestId('morph-result');
    expect(morphIdCalls()).toHaveLength(1);
    expect(morphIdCalls()[0][1].body.imageUrls).toEqual(['https://cdn.test/top-a.jpg', 'https://cdn.test/side-a.jpg']);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('keeps the yes for a retry of the same photos and asks again for new ones', async () => {
    fx.remaining = 3;
    fx.user = { ...fx.user, membership_tier: 'keeper' };
    fx.invoke = vi.fn()
      .mockResolvedValueOnce({ data: { error: 'Provider failed', code: 'upstream_error', credit_refunded: true }, error: null })
      .mockResolvedValue({ data: { analysis: ANALYSIS, tier: 'keeper', credits_remaining: 2 }, error: null });
    const user = userEvent.setup();
    renderPage();
    await choosePhotos(user);
    await identify(user);
    await user.click(screen.getByRole('button', { name: /Allow and identify/ }));

    // The first try failed on the provider's side. Try again sends the same
    // request (same key, so no second scan) without asking again.
    await user.click(await screen.findByRole('button', { name: /Try again/ }));
    await screen.findByTestId('morph-result');
    expect(morphIdCalls()).toHaveLength(2);
    expect(morphIdCalls()[1][1].body.request_key).toBe(morphIdCalls()[0][1].body.request_key);
    expect(screen.queryByRole('region', { name: 'Before we send your photos' })).toBeNull();

    // A new set of photos is a new request: the step asks first.
    await choosePhotos(user, 'B');
    await identify(user);
    expect(screen.getByRole('region', { name: 'Before we send your photos' })).toBeTruthy();
    expect(morphIdCalls()).toHaveLength(2);
    expect(window.confirm).not.toHaveBeenCalled();
  });
});

describe('Morph ID result for a free member', () => {
  it('does not cover the result with the used-this-month card', async () => {
    const user = userEvent.setup();
    renderPage();
    await choosePhotos(user);
    await identify(user);
    await user.click(screen.getByRole('button', { name: /Allow and identify/ }));

    expect(await screen.findByTestId('morph-result')).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/That was this month.s free identification/)).toBeTruthy());
    expect(screen.queryByText("You have used this month's free Morph ID")).toBeNull();
    expect(fx.upgradePromptShown).not.toHaveBeenCalledWith('morph_id', 'morph_id_locked');
  });

  it('still shows that card to a member who arrives with none left', async () => {
    fx.remaining = 0;
    renderPage();
    expect(await screen.findByText("You have used this month's free Morph ID")).toBeTruthy();
    expect(fx.upgradePromptShown).toHaveBeenCalledWith('morph_id', 'morph_id_locked');
  });
});

describe('Add this gecko', () => {
  async function runToResult() {
    const user = userEvent.setup();
    renderPage();
    await choosePhotos(user);
    await identify(user);
    await user.click(screen.getByRole('button', { name: /Allow and identify/ }));
    await screen.findByTestId('morph-result');
    return user;
  }

  it('leads the result for a member who came from the first gecko starter', async () => {
    // FirstGeckoStarter's "Add by photo" marks the photo path for the tab.
    window.sessionStorage.setItem('geck_first_gecko_photo_path', '1');
    const user = await runToResult();

    const card = screen.getByTestId('morph-id-add-card');
    const result = screen.getByTestId('morph-result');
    // The card comes first in the page, right under the result anchor.
    expect(card.compareDocumentPosition(result) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(card.textContent).toContain('Your first gecko, step 1 of 3');
    expect(card.textContent).toContain('Add this Lilly White to your collection');
    expect(fx.captureEvent).toHaveBeenCalledWith('first_gecko_flow', expect.objectContaining({
      step: 'add', action: 'morph_id_result', outcome: 'success',
    }));

    // Its button hands the result to the short add form on My Geckos.
    await user.click(screen.getByRole('button', { name: /Add to my collection/ }));
    expect((await screen.findByTestId('my-geckos')).textContent).toContain('draft morph: Lilly White');
  });

  it('stays after the evidence for everyone else', async () => {
    await runToResult();
    const card = screen.getByTestId('morph-id-add-card');
    const result = screen.getByTestId('morph-result');
    expect(result.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(card.textContent).not.toContain('step 1 of 3');
    expect(fx.captureEvent).not.toHaveBeenCalledWith('first_gecko_flow', expect.anything());
  });
});
