// @vitest-environment jsdom
// The Morph Guide quiz teaser downloads the animation library
// (framer-motion) only when a visitor starts the quiz, so the Morph Guide
// draws without it. These tests check that the quiz still opens in place
// with focus on its first question, closes back to the teaser, and still
// works start to finish when that download fails.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';
import { MORPHS } from '@/data/morph-guide';
import { QUIZ_STEPS } from '@/lib/morphQuiz';

vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));

installDomHarness();

const SLOW = { timeout: 15000 };
const TEST_TIMEOUT = 30000;

async function renderQuiz() {
  const { default: MorphQuiz } = await import('@/components/morphguide/MorphQuiz');
  return render(
    <MemoryRouter>
      <MorphQuiz morphs={MORPHS} />
    </MemoryRouter>,
  );
}

describe('Morph Guide quiz', () => {
  it('neither quiz file imports the animation library with the page', () => {
    for (const file of ['MorphQuiz.jsx', 'MorphQuizPanel.jsx']) {
      const src = readFileSync(resolve(__dirname, '..', file), 'utf8');
      expect(src, file).not.toMatch(/^\s*import\s[^;]*from\s+['"]framer-motion['"]/m);
    }
  }, TEST_TIMEOUT);

  it('opens in place on Start with focus on the first question, and closes back to the teaser', async () => {
    const user = userEvent.setup();
    await renderQuiz();
    expect(screen.getByRole('heading', { name: 'Which features can you see?' })).toBeTruthy();
    // Have the animation library here first, as the teaser's preload
    // normally does, so a slow test machine does not hit the one second cap.
    const { loadQuizMotion } = await import('@/components/morphguide/MorphQuiz');
    await loadQuizMotion();

    await user.click(screen.getByRole('button', { name: 'Start the quiz' }));
    const first = await screen.findByRole('heading', { name: QUIZ_STEPS[0].question }, SLOW);
    // Focus moves just after the heading appears; under load the two can be
    // a moment apart, so wait for it rather than checking the same instant.
    await vi.waitFor(() => expect(document.activeElement).toBe(first), SLOW);
    // framer-motion drives the slide-in through the section's inline style.
    expect(screen.getByRole('region', { name: 'Which features can you see? quiz' }).getAttribute('style')).toMatch(/opacity/);
    expect(screen.queryByRole('heading', { name: 'Which features can you see?' })).toBeNull();

    await user.click(screen.getByRole('button', { name: new RegExp(QUIZ_STEPS[0].options[0].label) }));
    expect(await screen.findByRole('heading', { name: QUIZ_STEPS[1].question }, SLOW)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Close the quiz' }));
    expect(screen.getByRole('heading', { name: 'Which features can you see?' })).toBeTruthy();
  }, TEST_TIMEOUT);

  it('still opens and reaches the results when the animation library cannot download', async () => {
    vi.resetModules();
    vi.doMock('@/components/morphguide/quizMotion', () => {
      throw new Error('Failed to fetch dynamically imported module');
    });
    const user = userEvent.setup();
    await renderQuiz();

    await user.click(screen.getByRole('button', { name: 'Start the quiz' }));
    // Plain markup: no animation styles, because the library never arrived.
    const quiz = await screen.findByRole('region', { name: 'Which features can you see? quiz' }, SLOW);
    expect(quiz.getAttribute('style')).toBeNull();
    for (const step of QUIZ_STEPS) {
      const heading = await screen.findByRole('heading', { name: step.question }, SLOW);
      // Focus moves just after the heading appears; under load the two can be
      // a moment apart, so wait for it rather than checking the same instant.
      await vi.waitFor(() => expect(document.activeElement).toBe(heading), SLOW);
      const none = step.options.find((o) => o.id === 'none' || o.id === 'no') || step.options[0];
      await user.click(screen.getByRole('button', { name: new RegExp(none.label) }));
    }
    expect(await screen.findByRole('heading', { name: 'Guides to compare with your observations' }, SLOW)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Compare a photo with Morph ID/ })).toBeTruthy();
    vi.doUnmock('@/components/morphguide/quizMotion');
  }, TEST_TIMEOUT);

  it('opens without the animation after about a second when the download is slow, and says it is opening meanwhile', async () => {
    vi.resetModules();
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    vi.doMock('@/components/morphguide/quizMotion', async () => {
      await held;
      return vi.importActual('@/components/morphguide/quizMotion');
    });
    let MOTION_WAIT_MS;
    let loadQuizMotion;
    try {
      ({ MOTION_WAIT_MS, loadQuizMotion } = await import('@/components/morphguide/MorphQuiz'));
      expect(MOTION_WAIT_MS).toBeGreaterThan(0);
      expect(MOTION_WAIT_MS).toBeLessThanOrEqual(1000);
      const user = userEvent.setup();
      await renderQuiz();
      await user.click(screen.getByRole('button', { name: 'Start the quiz' }));
      const busy = screen.getByRole('button', { name: 'Opening the quiz' });
      expect(busy.getAttribute('aria-busy')).toBe('true');

      // The download is held until the end of this test, yet the quiz
      // opens, plain (it used to wait for the download).
      const first = await screen.findByRole('heading', { name: QUIZ_STEPS[0].question }, SLOW);
      // Focus moves just after the heading appears; under load the two can be
      // a moment apart, so wait for it rather than checking the same instant.
      await vi.waitFor(() => expect(document.activeElement).toBe(first), SLOW);
      expect(screen.getByRole('region', { name: 'Which features can you see? quiz' }).getAttribute('style')).toBeNull();
    } finally {
      // Let the held download finish before the next test mocks it afresh.
      release();
      await loadQuizMotion?.().catch(() => {});
      vi.doUnmock('@/components/morphguide/quizMotion');
    }
  }, TEST_TIMEOUT);

  it('starts the download when the teaser comes near the screen, and says it is opening', async () => {
    vi.resetModules();
    let downloaded = false;
    vi.doMock('@/components/morphguide/quizMotion', async () => {
      downloaded = true;
      return vi.importActual('@/components/morphguide/quizMotion');
    });
    const seen = [];
    const original = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = class {
      constructor(callback) { this.callback = callback; }
      observe(el) { seen.push(() => this.callback([{ isIntersecting: true, target: el }])); }
      disconnect() {}
    };
    try {
      await renderQuiz();
      expect(downloaded).toBe(false);
      seen.forEach((fire) => fire());
      await vi.waitFor(() => expect(downloaded).toBe(true), SLOW);
    } finally {
      globalThis.IntersectionObserver = original;
      vi.doUnmock('@/components/morphguide/quizMotion');
    }
  }, TEST_TIMEOUT);
});

