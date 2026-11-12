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
// - since 12 Nov 2026 (experience review, I1 to I4): the step is there
//   from the moment the photos are in and its button is the one tap; the
//   photo slots come before the cautions, which fold to one line above
//   them and show in full with the result; with no scan left the slots
//   stay, greyed out, with the date the next scan arrives; and a result
//   can be saved to a gecko the member already has, tick by tick, without
//   touching the tags it had;
// - the "used this month's free Morph ID" card does not sit on top of the
//   result a free member just got (the scans-left refresh used to flip the
//   lock before the answer showed);
// - a member who came from the first gecko starter gets "Add this gecko"
//   directly under the result, ahead of the evidence; others keep it after.
//   The photo path flag counts only while the collection is empty, and the
//   card names the morph as Morph ID's suggestion, never as the gecko's.
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';
import { suggestedTagsFromAnalysis } from '@/lib/morphIdDraft';

const fx = vi.hoisted(() => ({
  user: null,
  remaining: 1,
  bonus: 0,
  liveGeckos: 0,
  countLiveGeckos: null,
  invoke: null,
  captureEvent: null,
  upgradePromptShown: null,
  geckos: [],
  memberships: [],
  geckoUpdate: null,
  toasts: [],
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    rpc: async (name) => (name === 'morph_id_scans_remaining'
      ? { data: { remaining: fx.remaining, bonus: fx.bonus }, error: null }
      : { data: null, error: null }),
    functions: { invoke: (...args) => fx.invoke(...args) },
  },
}));
// The live gecko count (src/lib/liveGeckoCount.js, tested on its own).
vi.mock('@/lib/liveGeckoCount', () => ({
  countLiveGeckos: (...args) => fx.countLiveGeckos(...args),
}));
// The collection, for "Save to a gecko you already have" and for Morph ID
// opened from a gecko's record. geckoAccess itself is the real one.
vi.mock('@/entities/all', () => ({
  Gecko: {
    get: async (id) => fx.geckos.find((g) => g.id === id) || null,
    filter: async () => fx.geckos,
    update: (...args) => fx.geckoUpdate(...args),
  },
  CollectionMember: { filter: async () => fx.memberships },
}));
vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: fx.user, isGuest: false, isLoadingAuth: false }),
}));
// The toaster is not on this page, so what it was asked to show is kept.
vi.mock('@/components/ui/use-toast', () => ({
  toast: (t) => { fx.toasts.push(t); },
  useToast: () => ({ toast: (t) => { fx.toasts.push(t); } }),
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
  default: ({ onChange, disabled = false }) => (
    <div data-testid="photo-slots" data-disabled={String(disabled)}>
      <button type="button" disabled={disabled} onClick={() => onChange({ urls: ['https://cdn.test/top-a.jpg', 'https://cdn.test/side-a.jpg'], ready: true })}>
        Use photo set A
      </button>
      <button type="button" disabled={disabled} onClick={() => onChange({ urls: ['https://cdn.test/top-b.jpg', 'https://cdn.test/side-b.jpg'], ready: true })}>
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

import Recognition from '@/pages/Recognition';

installDomHarness();

// A Lilly White on a harlequin base: Morph ID leads with "Lilly White".
// A best visual match with a strong model signal (0 to 100), as the
// server answers (supabase/functions/_shared/morph-evidence.ts).
const ANALYSIS = {
  primary_morph: 'harlequin',
  genetic_traits: ['lily_white'],
  secondary_traits: [],
  base_color: 'cream',
  assessment_status: 'best_match',
  model_signal: 82,
};
const OK = { data: { analysis: ANALYSIS, tier: 'free', credits_remaining: 0 }, error: null };

function MyGeckosStub() {
  const location = useLocation();
  const draft = location.state?.geckoDraft;
  return (
    <p data-testid="my-geckos">
      draft morph: {draft?.morphs_traits}; check morph: {String(draft?.check_morph)}; search: {location.search}
    </p>
  );
}

function RecordStub() {
  const location = useLocation();
  return <p data-testid="gecko-record">record: {location.pathname}{location.search}</p>;
}

let client;
function renderPage(start = '/Recognition') {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[start]}>
        <Routes>
          <Route path="/Recognition" element={<Recognition />} />
          <Route path="/MyGeckos" element={<MyGeckosStub />} />
          <Route path="/GeckoDetail" element={<RecordStub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const morphIdCalls = () => fx.invoke.mock.calls.filter(([name]) => name === 'recognize-gecko-morph');

async function choosePhotos(user, set = 'A') {
  await user.click(await screen.findByRole('button', { name: `Use photo set ${set}` }));
}

// One tap: the permission step is on the page once the photos are in.
async function allowAndIdentify(user) {
  await user.click(screen.getByRole('button', { name: /Allow and identify/ }));
}

async function runToResult(start) {
  const user = userEvent.setup();
  renderPage(start);
  await choosePhotos(user);
  await allowAndIdentify(user);
  await screen.findByTestId('morph-result');
  return user;
}

const FOLLOWS = Node.DOCUMENT_POSITION_FOLLOWING;
const before = (first, second) => Boolean(first.compareDocumentPosition(second) & FOLLOWS);

beforeEach(() => {
  window.history.replaceState(null, '', '/Recognition');
  fx.user = { id: 'p1', auth_user_id: 'auth-1', email: 'sam@example.com', role: 'user', membership_tier: 'free' };
  fx.remaining = 1;
  fx.bonus = 0;
  fx.liveGeckos = 0;
  fx.countLiveGeckos = vi.fn(async () => fx.liveGeckos);
  fx.captureEvent = vi.fn();
  fx.upgradePromptShown = vi.fn();
  fx.geckos = [];
  fx.memberships = [];
  fx.geckoUpdate = vi.fn(async (id, fields) => ({ id, ...fields }));
  fx.toasts.length = 0;
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
  it('asks on the page from the start, and sends nothing without a yes', async () => {
    const user = userEvent.setup();
    renderPage();
    // No photos yet: nothing to allow.
    expect(screen.queryByRole('region', { name: 'Before we send your photos' })).toBeNull();
    await choosePhotos(user);

    // The step is there as soon as the photos are, with no tap needed to
    // reach it, and its button is the only one that identifies.
    const panel = screen.getByRole('region', { name: 'Before we send your photos' });
    expect(panel.textContent).toContain('Anthropic');
    expect(panel.textContent).toContain('Replicate');
    expect(panel.textContent).toContain('permission to share');
    expect(panel.textContent).toContain('Nothing is sent until you tap Allow and identify');
    expect(screen.queryByRole('button', { name: /Identify morph/ })).toBeNull();
    const allow = screen.getByRole('button', { name: /Allow and identify/ });
    // The button comes first and the notice sits under it, described by it.
    const notice = document.getElementById(allow.getAttribute('aria-describedby'));
    expect(notice.textContent).toContain('Before we send your photos');
    expect(allow.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fx.invoke).not.toHaveBeenCalled();
    expect(fx.captureEvent).toHaveBeenCalledWith('morph_id_consent', expect.objectContaining({ action: 'shown', photo_count: 2 }));
    expect(fx.captureEvent.mock.calls.filter(([name, props]) => name === 'morph_id_consent' && props.action === 'shown')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.getByRole('status').textContent).toContain('Nothing was sent and no scan was used');
    expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();
    expect(fx.invoke).not.toHaveBeenCalled();
    expect(fx.captureEvent).toHaveBeenCalledWith('morph_id_consent', expect.objectContaining({ action: 'declined' }));
    expect(fx.captureEvent).toHaveBeenCalledWith('morph_id_result', expect.objectContaining({ outcome: 'error', error_code: 'ai_consent_declined' }));

    // After "Not now" the step is still there; the yes sends.
    await allowAndIdentify(user);
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
    await allowAndIdentify(user);

    // The first try failed on the provider's side. Try again sends the same
    // request (same key, so no second scan) without asking again.
    await user.click(await screen.findByRole('button', { name: /Try again/ }));
    await screen.findByTestId('morph-result');
    expect(morphIdCalls()).toHaveLength(2);
    expect(morphIdCalls()[1][1].body.request_key).toBe(morphIdCalls()[0][1].body.request_key);
    // With a yes for these photos the step is gone and the button is the
    // plain one.
    expect(screen.queryByRole('region', { name: 'Before we send your photos' })).toBeNull();
    expect(screen.getByRole('button', { name: /Identify morph/ })).toBeTruthy();

    // A new set of photos is a new request: the step asks first.
    await choosePhotos(user, 'B');
    expect(screen.getByRole('region', { name: 'Before we send your photos' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Identify morph/ })).toBeNull();
    expect(morphIdCalls()).toHaveLength(2);
    expect(window.confirm).not.toHaveBeenCalled();
  });
});

describe('Morph ID result for a free member', () => {
  it('does not cover the result with the used-this-month card', async () => {
    const user = userEvent.setup();
    renderPage();
    await choosePhotos(user);
    await allowAndIdentify(user);

    expect(await screen.findByTestId('morph-result')).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/That was this month.s free identification/)).toBeTruthy());
    expect(screen.queryByText("You have used this month's free Morph ID")).toBeNull();
    expect(fx.upgradePromptShown).not.toHaveBeenCalledWith('morph_id', 'morph_id_locked');
  });

  it('never shows that card while the scan is running, even when scans left reads 0 first', async () => {
    // The answer is held back, so the scan stays on screen while the
    // scans-left read refreshes. The server takes the scan when it starts,
    // so the refresh (a member coming back to the tab a minute in) reads 0
    // before any result exists. Only the !isAnalyzing part of the rule
    // keeps the card away here.
    let answer;
    fx.invoke = vi.fn(() => new Promise((resolve) => { answer = resolve; }));
    const user = userEvent.setup();
    renderPage();
    await choosePhotos(user);
    await allowAndIdentify(user);
    expect(await screen.findByText('Identifying your gecko')).toBeTruthy();

    fx.remaining = 0;
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['morph-id-scans-remaining'] });
    });
    await waitFor(() => expect(client.getQueryData(['morph-id-scans-remaining', 'auth-1', true])?.remaining).toBe(0));
    expect(screen.getByText('Identifying your gecko')).toBeTruthy();
    expect(screen.queryByText("You have used this month's free Morph ID")).toBeNull();

    await act(async () => { answer(OK); });
    expect(await screen.findByTestId('morph-result')).toBeTruthy();
    expect(screen.queryByText("You have used this month's free Morph ID")).toBeNull();
    expect(fx.upgradePromptShown).not.toHaveBeenCalledWith('morph_id', 'morph_id_locked');
  });

  it('says when the next free one comes after the last extra scan is used', async () => {
    // morph_id_scans_remaining reports bonus as the extra scans granted and
    // not yet expired, used or not, so 0 left with a bonus of 1 is real.
    fx.bonus = 1;
    const user = userEvent.setup();
    renderPage();
    await choosePhotos(user);
    await allowAndIdentify(user);

    expect(await screen.findByTestId('morph-result')).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/That was your last Morph ID scan for now\. Your next free identification arrives/)).toBeTruthy());
    expect(screen.queryByText(/That was this month.s free identification/)).toBeNull();
    expect(screen.queryByText('You have used your Morph ID scans')).toBeNull();
  });

  it('still shows that card to a member who arrives with none left', async () => {
    fx.remaining = 0;
    renderPage();
    expect(await screen.findByText("You have used this month's free Morph ID")).toBeTruthy();
    expect(fx.upgradePromptShown).toHaveBeenCalledWith('morph_id', 'morph_id_locked');
  });
});

describe('Add this gecko', () => {
  it('leads the result for a member who came from the first gecko starter', async () => {
    // FirstGeckoStarter's "Add by photo" marks the photo path for the tab.
    window.sessionStorage.setItem('geck_first_gecko_photo_path', '1');
    const user = await runToResult();

    const card = screen.getByTestId('morph-id-add-card');
    const result = screen.getByTestId('morph-result');
    // The card comes first in the page, right under the result anchor.
    expect(card.compareDocumentPosition(result) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(card.textContent).toContain('Your first gecko, step 1 of 3');
    // Before the evidence, the morph is Morph ID's suggestion, not a label.
    expect(card.textContent).toContain('Add this gecko. Morph ID suggests Lilly White');
    expect(card.textContent).not.toContain('Add this Lilly White');
    expect(card.textContent).toContain('you can change the morph');
    expect(fx.countLiveGeckos).toHaveBeenCalledTimes(1);
    expect(fx.countLiveGeckos.mock.calls[0][1]).toBe('sam@example.com');
    expect(fx.captureEvent).toHaveBeenCalledWith('first_gecko_flow', expect.objectContaining({
      step: 'add', action: 'morph_id_result', outcome: 'success',
    }));
    expect(fx.captureEvent).toHaveBeenCalledWith('morph_id_consent', expect.objectContaining({ action: 'allowed', first_gecko: true }));

    // Its button hands the result to the short add form on My Geckos.
    await user.click(screen.getByRole('button', { name: /Add to my collection/ }));
    const myGeckos = (await screen.findByTestId('my-geckos')).textContent;
    expect(myGeckos).toContain('draft morph: Lilly White');
    expect(myGeckos).toContain('check morph: false');
  });

  it('asks the newest member to check the morph when Morph ID was unsure', async () => {
    window.sessionStorage.setItem('geck_first_gecko_photo_path', '1');
    // A tentative shortlist: the breeder-tagged reference photos lean to
    // another morph and the model signal is low.
    const unsure = {
      ...ANALYSIS,
      assessment_status: 'tentative',
      model_signal: 58,
      visual_evidence: { status: 'available', neighbors: [], consensus: { primary_morph: 'dalmatian' } },
    };
    fx.invoke = vi.fn(async () => {
      fx.remaining = 0;
      return { data: { analysis: unsure, tier: 'free', credits_remaining: 0 }, error: null };
    });
    const user = await runToResult();

    const card = screen.getByTestId('morph-id-add-card');
    expect(card.textContent).toContain('Add this gecko. Morph ID suggests Lilly White');
    expect(card.textContent).toContain('Morph ID was not sure about this one, so check the morph before you save');
    await user.click(screen.getByRole('button', { name: /Add to my collection/ }));
    expect((await screen.findByTestId('my-geckos')).textContent).toContain('check morph: true');
  });

  it('ignores a photo path flag left over once the collection has a gecko', async () => {
    // The flag lasts the whole tab session. This member picked Add by photo
    // earlier, typed a gecko in instead and now runs Morph ID on another.
    window.sessionStorage.setItem('geck_first_gecko_photo_path', '1');
    fx.liveGeckos = 1;
    renderPage();
    await waitFor(() => expect(fx.countLiveGeckos).toHaveBeenCalledTimes(1));
    // A collection with a gecko clears the flag for good.
    await waitFor(() => expect(window.sessionStorage.getItem('geck_first_gecko_photo_path')).toBeNull());
    const user = userEvent.setup();
    await choosePhotos(user);
    await allowAndIdentify(user);
    await screen.findByTestId('morph-result');

    expect(screen.queryByText(/step 1 of 3/)).toBeNull();
    const card = screen.getByTestId('morph-id-add-card');
    const result = screen.getByTestId('morph-result');
    expect(result.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fx.captureEvent).not.toHaveBeenCalledWith('first_gecko_flow', expect.anything());
    expect(fx.captureEvent).toHaveBeenCalledWith('morph_id_consent', expect.objectContaining({ action: 'allowed', first_gecko: false }));
  });

  it('shows no step while the gecko count is unknown', async () => {
    window.sessionStorage.setItem('geck_first_gecko_photo_path', '1');
    fx.countLiveGeckos = vi.fn(async () => { throw new Error('offline'); });
    await runToResult();
    expect(screen.queryByText(/step 1 of 3/)).toBeNull();
    expect(fx.captureEvent).not.toHaveBeenCalledWith('first_gecko_flow', expect.anything());
  });

  it('drops the photo path when the member types the gecko in instead', async () => {
    window.sessionStorage.setItem('geck_first_gecko_photo_path', '1');
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('link', { name: 'Type it in instead' }));
    expect((await screen.findByTestId('my-geckos')).textContent).toContain('search: ?add=1&how=type');
    expect(window.sessionStorage.getItem('geck_first_gecko_photo_path')).toBeNull();
  });

  it('stays after the evidence for everyone else', async () => {
    await runToResult();
    const card = screen.getByTestId('morph-id-add-card');
    const result = screen.getByTestId('morph-result');
    expect(result.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(card.textContent).not.toContain('step 1 of 3');
    expect(fx.captureEvent).not.toHaveBeenCalledWith('first_gecko_flow', expect.anything());
    // No flag, so there is no count to read.
    expect(fx.countLiveGeckos).not.toHaveBeenCalled();
  });
});

describe('Morph ID cautions and the photo slots', () => {
  // The four cautions (PHOTO_LIMITS). None may be dropped, only moved.
  const CAUTIONS = [
    'Line-bred looks copy proven genes',
    'Some genes look alike by design',
    'Hidden genes never show',
    'Fired state and light change everything',
  ];
  const SENTENCE = 'Morph ID reads what is visible. A photo cannot prove a gene.';

  it('puts the photo slots first, under one line that unfolds the four cautions', async () => {
    const user = userEvent.setup();
    renderPage();
    const slots = await screen.findByTestId('photo-slots');
    const line = screen.getByTestId('morph-id-limits-line');
    expect(line.textContent).toContain(SENTENCE);
    // Only the header and that line are above the slots; the steps and the
    // photo tips moved under them.
    expect(before(line, slots)).toBe(true);
    expect(before(slots, screen.getByText('Photo tips and supported morphs'))).toBe(true);
    expect(before(slots, screen.getByText(/Confirm or request review/))).toBe(true);
    expect(screen.getByText('Crested geckos only. Other species will be rejected as insufficient evidence.')).toBeTruthy();

    // Folded, not gone: in the page, hidden until asked for.
    const toggle = screen.getByRole('button', { name: /What a photo can't tell you/ });
    const folded = document.getElementById(toggle.getAttribute('aria-controls'));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(folded.hidden).toBe(true);
    for (const title of CAUTIONS) expect(folded.textContent, title).toContain(title);
    expect(folded.textContent).toContain("Lineage settles what photos can't.");
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(folded.hidden).toBe(false);
    // The full card waits for a result.
    expect(screen.queryByTestId('morph-id-limits-full')).toBeNull();
  });

  it('shows the cautions in full with the result, and the sentence above it', async () => {
    await runToResult();
    const result = screen.getByTestId('morph-result');
    const sentence = screen.getByTestId('morph-id-result-limits-line');
    const full = screen.getByTestId('morph-id-limits-full');
    expect(sentence.textContent).toContain(SENTENCE);
    expect(before(sentence, result)).toBe(true);
    expect(before(result, full)).toBe(true);
    for (const title of CAUTIONS) expect(full.textContent, title).toContain(title);
    expect(full.textContent).toContain("What a photo can't tell you");
    expect(full.textContent).toContain('not a genetic test');
  });
});

describe('Morph ID with no scan left', () => {
  it('keeps the photo slots on the page, greyed out, with the date and the plans button', async () => {
    fx.remaining = 0;
    renderPage();
    const notice = await screen.findByTestId('morph-id-locked');
    expect(notice.textContent).toContain("You have used this month's free Morph ID");
    // The real rule (src/lib/creditReset.js): midnight UTC on the 1st, said
    // in the member's own time.
    expect(notice.textContent).toMatch(/Your next free identification arrives on [A-Z][a-z]{2} \d{1,2} at \d{1,2}:\d{2}\s?[AP]M your time/);
    expect(within(notice).getByRole('button', { name: 'See plans' })).toBeTruthy();

    const slots = screen.getByTestId('photo-slots');
    expect(slots.getAttribute('data-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'Use photo set A' }).disabled).toBe(true);
    expect(before(notice, slots)).toBe(true);
    expect(screen.getByTestId('morph-id-upload-closed').textContent).toMatch(/Photo upload opens again on .+ your time, when your next free identification arrives\./);
    expect(screen.queryByRole('button', { name: /Allow and identify/ })).toBeNull();
  });

  it('says when a paid plan\'s scans come back', async () => {
    fx.remaining = 0;
    fx.user = { ...fx.user, membership_tier: 'keeper' };
    renderPage();
    const notice = await screen.findByTestId('morph-id-locked');
    expect(notice.textContent).toContain("You're out of Morph ID scans for this month");
    expect(notice.textContent).toMatch(/Your monthly scans reset on /);
    expect(screen.getByTestId('photo-slots').getAttribute('data-disabled')).toBe('true');
  });

  it('leaves the slots live and shows no notice while there is a scan to use', async () => {
    renderPage();
    const slots = await screen.findByTestId('photo-slots');
    await waitFor(() => expect(screen.getByText('Your free identification this month is ready.')).toBeTruthy());
    expect(slots.getAttribute('data-disabled')).toBe('false');
    expect(screen.queryByTestId('morph-id-locked')).toBeNull();
    expect(screen.queryByTestId('morph-id-upload-closed')).toBeNull();
  });
});

describe('Save a result to a gecko the member already has', () => {
  // Mango is Sam's own. Borrowed sits in a collection Sam can only view.
  const MANGO = { id: 'g-mango', name: 'Mango', created_by: 'sam@example.com', archived: false, morph_tags: ['Dalmatian', 'Harlequin'] };
  const BORROWED = { id: 'g-view', name: 'Borrowed', created_by: 'other@example.com', collection_id: 'c-view', archived: false, morph_tags: [] };
  // What the result maps to, from the same list "Add to my collection" uses.
  const SUGGESTED = suggestedTagsFromAnalysis(ANALYSIS).map((entry) => entry.tag);

  beforeEach(() => {
    // A paid plan, so the page is not locked after the scan.
    fx.remaining = 3;
    fx.user = { ...fx.user, membership_tier: 'keeper' };
    fx.invoke = vi.fn(async () => ({ data: { analysis: ANALYSIS, tier: 'keeper', credits_remaining: 2 }, error: null }));
    fx.geckos = [MANGO, BORROWED];
    fx.memberships = [{ collection_id: 'c-view', status: 'accepted', role: 'viewer' }];
  });

  it('maps the result to Harlequin and Lilly White, as the add form does', () => {
    expect(SUGGESTED).toEqual(expect.arrayContaining(['Harlequin', 'Lilly White']));
  });

  it('picks a gecko, confirms trait by trait, and keeps the tags it already had', async () => {
    const user = await runToResult();
    await user.click(screen.getByRole('button', { name: /Save to a gecko you already have/ }));
    const dialog = await screen.findByRole('dialog');

    // Only geckos this member may change are offered.
    await user.click(await within(dialog).findByRole('button', { name: /Mango/ }));
    expect(within(dialog).queryByRole('button', { name: /Borrowed/ })).toBeNull();

    // Nothing is ticked to start with, and nothing can be saved unticked.
    expect(within(dialog).getByRole('heading', { name: 'Save to Mango' })).toBeTruthy();
    const boxes = within(dialog).getAllByRole('checkbox');
    expect(boxes).toHaveLength(SUGGESTED.length - 1);
    for (const box of boxes) expect(box.getAttribute('aria-checked')).toBe('false');
    expect(within(dialog).getByRole('button', { name: 'Save' }).disabled).toBe(true);
    // Harlequin is on Mango already: said, not offered again.
    expect(dialog.textContent).toContain('Already on Mango: Harlequin.');
    expect(within(dialog).queryByRole('checkbox', { name: 'Harlequin' })).toBeNull();
    // A trait named after a gene is never offered as proven.
    expect(dialog.textContent).toContain('The photos can show the Lilly White look, not prove the gene.');
    expect(dialog.textContent).toContain('Morph ID reads what is visible. A photo cannot prove a gene.');

    await user.click(within(dialog).getByRole('checkbox', { name: 'Lilly White' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save 1 trait' }));
    await waitFor(() => expect(fx.geckoUpdate).toHaveBeenCalledTimes(1));
    // Only the ticked trait is added, after the tags Mango had, untouched.
    expect(fx.geckoUpdate).toHaveBeenCalledWith('g-mango', { morph_tags: ['Dalmatian', 'Harlequin', 'Lilly White'] });

    // The toast names the gecko and opens its record; so does the page.
    const said = fx.toasts.at(-1);
    expect(said.title).toBe('Saved to Mango');
    expect(said.description).toContain('1 trait added to its morph tags: Lilly White.');
    expect(said.action).toBeTruthy();
    const link = await screen.findByRole('link', { name: 'Open the record for Mango' });
    expect(link.getAttribute('href')).toBe('/GeckoDetail?id=g-mango');
    expect(fx.captureEvent).toHaveBeenCalledWith('morph_id_saved_to_gecko', { added: 1, suggested: SUGGESTED.length, from_record: false });
    // A new gecko is still one tap away.
    expect(screen.getByRole('button', { name: /Add to my collection/ })).toBeTruthy();
  });

  it('opened from a gecko\'s record, it names the gecko, leads with Save to it and goes back', async () => {
    const user = userEvent.setup();
    renderPage('/Recognition?gecko=g-mango');
    expect(await screen.findByRole('heading', { name: 'Identifying Mango' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to Mango' }).getAttribute('href')).toBe('/GeckoDetail?id=g-mango');
    await choosePhotos(user);
    await allowAndIdentify(user);
    const result = await screen.findByTestId('morph-result');

    // Saving to Mango leads the result, ahead of the evidence.
    const card = screen.getByTestId('morph-id-save-card');
    expect(before(card, result)).toBe(true);
    expect(card.textContent).toContain('Morph ID suggests Lilly White');
    await user.click(within(card).getByRole('button', { name: /Save to Mango/ }));

    // Straight to the traits: the gecko is already known.
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Save to Mango' })).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: /Choose another gecko/ })).toBeNull();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Lilly White' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save 1 trait' }));

    // Back on Mango's record, with the tags it had kept.
    expect((await screen.findByTestId('gecko-record')).textContent).toContain('/GeckoDetail?id=g-mango');
    expect(fx.geckoUpdate).toHaveBeenCalledWith('g-mango', { morph_tags: ['Dalmatian', 'Harlequin', 'Lilly White'] });
    expect(fx.toasts.at(-1).title).toBe('Saved to Mango');
    expect(fx.captureEvent).toHaveBeenCalledWith('morph_id_saved_to_gecko', expect.objectContaining({ from_record: true }));
  });

  it('is plain Morph ID for a gecko the member cannot change', async () => {
    await runToResult('/Recognition?gecko=g-view');
    expect(screen.queryByTestId('morph-id-target')).toBeNull();
    expect(screen.queryByTestId('morph-id-save-card')).toBeNull();
    expect(screen.getByRole('button', { name: /Save to a gecko you already have/ })).toBeTruthy();
  });

  it('is not offered on the guided first gecko, whose collection is empty', async () => {
    window.sessionStorage.setItem('geck_first_gecko_photo_path', '1');
    fx.geckos = [];
    await runToResult();
    expect(screen.getByTestId('morph-id-add-card').textContent).toContain('step 1 of 3');
    expect(screen.queryByRole('button', { name: /Save to a gecko you already have/ })).toBeNull();
  });
});

describe('Morph ID permission panel', () => {
  // Beside the step, never instead of it: an in-app route unmounts Morph ID
  // and loses the photos the member picked. A new tab on the web; in the
  // iPhone app the in-app browser sheet (AiConsentPanel's openPolicyBeside).
  it('opens the Privacy Policy beside the step, so the picked photos stay', async () => {
    const user = userEvent.setup();
    renderPage();
    await choosePhotos(user);
    const link = screen.getByRole('link', { name: 'Privacy Policy, Third-Party Services' });
    expect(link.getAttribute('href')).toBe('/PrivacyPolicy');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });
});
