// @vitest-environment jsdom
// The report button on member photos downloads as its own file, with the
// first photo (src/pages/MorphDetail.jsx). A tab opened before a release
// asks for a file name that no longer exists, and a phone can drop one
// request. Either way the Morph Guide page must stay up without the
// button, signed in or not, instead of falling through to the app-wide
// "Something went wrong" screen. Only the network edges are stubbed.
import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

// What Chrome says when a file from an older release is gone.
const STALE = 'Failed to fetch dynamically imported module: https://geckinspect.com/assets/ReportContent-old.js';
const reportImport = vi.hoisted(() => ({ attempts: 0 }));

vi.mock('@/components/support/ReportContent', () => {
  reportImport.attempts += 1;
  throw new TypeError(STALE);
});
// One approved member photo, as morph_community_photos returns it.
vi.mock('@/lib/morphPhotoSubmissions', () => ({
  fetchMorphCommunityPhotos: async () => [{
    id: 'submission-1',
    submission_id: 1,
    image_url: 'https://example.com/harlequin.jpg',
    credit: 'a Geck Inspect member',
    owner_profile_id: null,
  }],
}));
// The morph_guides request fails, as it does offline; the built-in guide
// still draws the page.
vi.mock('@/lib/supabaseLazy', () => ({ getSupabase: () => Promise.reject(new Error('offline')) }));
vi.mock('@/hooks/useBlockedAuthors', () => ({ useBlockedMembers: () => ({ isBlocked: () => false }) }));
vi.mock('@/components/public/ContentSignupPrompt', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: ({ headline }) => <p>{headline}</p> };
});
vi.mock('@/lib/telemetry', () => ({ reportError: vi.fn() }));
vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));

import ErrorBoundary from '@/components/ErrorBoundary';
import MorphDetail from '@/pages/MorphDetail';

installDomHarness();
// The section bar scrolls its active link into view; jsdom has no layout.
Element.prototype.scrollTo ||= function scrollTo() {};

const SLOW = { timeout: 15000 };
const TEST_TIMEOUT = 30000;

describe('Morph Guide page when the report button cannot download', () => {
  it('keeps the page, its heading and the community photos, without the button', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <ErrorBoundary>
          <HelmetProvider>
            <MemoryRouter initialEntries={['/MorphGuide/harlequin']}>
              <Routes>
                <Route path="/MorphGuide/:slug" element={<MorphDetail />} />
              </Routes>
            </MemoryRouter>
          </HelmetProvider>
        </ErrorBoundary>,
      );
      // The community section appears once the photo arrives, which is
      // also when the page asks for the report button's file.
      expect(await screen.findByRole('heading', { name: 'From the Geck Inspect community' }, SLOW)).toBeTruthy();
      await vi.waitFor(() => expect(reportImport.attempts).toBeGreaterThan(0), SLOW);
      // Let the failed download settle, then read the page again.
      await new Promise((r) => setTimeout(r, 50));

      expect(screen.queryByText('Something went wrong')).toBeNull();
      expect(screen.getByRole('heading', { level: 1, name: /Harlequin/ })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'From the Geck Inspect community' })).toBeTruthy();
      expect(screen.getByAltText('Harlequin crested gecko, photo by a Geck Inspect member')).toBeTruthy();
      expect(screen.getByText('Photo by a Geck Inspect member')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /report/i })).toBeNull();
    } finally {
      error.mockRestore();
    }
  }, TEST_TIMEOUT);
});
