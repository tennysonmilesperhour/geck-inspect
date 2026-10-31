// @vitest-environment jsdom
// The Field Notebook on every Morph Guide page has four study modes. On 18
// and 22 Oct 2026 pressing "2 · Pattern studio" threw (the base tone groups
// had no tone lists), and with no boundary around the study the whole page
// became the error screen for signed-out visitors. These tests press every
// mode, check each base tone button is there, and check a broken study is
// caught by its own section boundary.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';
import ErrorBoundary from '@/components/ErrorBoundary';
import PatternSpectrum from '@/components/morphguide/PatternSpectrum';
import { BASE_TONES, BASE_TONE_GROUPS } from '@/components/morphguide/TraitGecko';

vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ reportError: vi.fn() }));

installDomHarness();

const TEST_TIMEOUT = 30000;
const MODES = ['1 · Guided observations', '2 · Pattern studio', '3 · Test your eye', '4 · Animated transitions'];

describe('Field Notebook study modes', () => {
  it('every base tone belongs to exactly one picker group', () => {
    const listed = BASE_TONE_GROUPS.flatMap((group) => group.tones);
    expect([...listed].sort()).toEqual(Object.keys(BASE_TONES).sort());
    for (const group of BASE_TONE_GROUPS) expect(group.tones.length, group.id).toBeGreaterThan(0);
  });

  it('opens each study mode without throwing, with every base tone in the Pattern studio', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PatternSpectrum focusSlug="red-base" />
      </MemoryRouter>,
    );
    for (const label of MODES) {
      await user.click(screen.getByRole('button', { name: label }));
      expect(screen.getByRole('button', { name: label }).getAttribute('aria-pressed')).toBe('true');
      if (label === '2 · Pattern studio') {
        for (const group of BASE_TONE_GROUPS) {
          const picker = within(screen.getByRole('group', { name: group.label }));
          for (const id of group.tones) {
            expect(picker.getByRole('button', { name: BASE_TONES[id].label })).toBeTruthy();
          }
        }
      }
    }
  }, TEST_TIMEOUT);

  it('a study that throws shows its own note and leaves the page standing', () => {
    const Broken = () => {
      throw new Error('study failed');
    };
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <div>
        <h1>Lilly White</h1>
        <ErrorBoundary scope="PatternSpectrum" fallback={<p>The pattern study could not load.</p>}>
          <Broken />
        </ErrorBoundary>
      </div>,
    );
    quiet.mockRestore();
    expect(screen.getByRole('heading', { name: 'Lilly White' })).toBeTruthy();
    expect(screen.getByText('The pattern study could not load.')).toBeTruthy();
  });
});
