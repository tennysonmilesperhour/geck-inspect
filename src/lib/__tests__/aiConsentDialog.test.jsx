// @vitest-environment jsdom
// The in-app question that stands in for the browser's confirm box before
// an AI request (the health screen, visual search, the text request and
// AI Image Import). The iPhone app's web view does not reliably show a
// confirm box, so those features failed there as "canceled".
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';
import { AI_CONSENT_NOTE, AI_CONSENT_TITLE, askAiConsent } from '@/lib/aiConsentDialog';

installDomHarness();

const DISCLOSURE = 'Send this gecko photo, name, hatch date, weight and morph details to Anthropic for an AI health screen?';
const hosts = () => document.querySelectorAll('[data-ai-consent]');

// Start the question and wait for the dialog to be on the page. The
// answer comes back wrapped, because returning the promise itself from an
// async function would wait for the member's answer.
async function ask(disclosure = DISCLOSURE) {
  let answer;
  await act(async () => { answer = askAiConsent(disclosure); });
  await screen.findByRole('alertdialog');
  return { answer };
}

beforeEach(() => {
  window.confirm = vi.fn(() => { throw new Error('the browser confirm box was used'); });
});
afterEach(() => {
  // A test that failed half way must not leave a dialog for the next one.
  hosts().forEach((host) => host.remove());
});

describe('askAiConsent', () => {
  it('names what is sent and to whom, and how to say no', async () => {
    const { answer } = await ask();
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain(AI_CONSENT_TITLE);
    expect(dialog.textContent).toContain(DISCLOSURE);
    expect(dialog.textContent).toContain(AI_CONSENT_NOTE);
    expect(AI_CONSENT_NOTE).toContain('permission to share');
    expect(AI_CONSENT_NOTE).toContain('Privacy Policy > Third-Party Services');
    expect(AI_CONSENT_NOTE).toContain('Cancel keeps this request from being sent');
    expect(screen.getByRole('button', { name: 'Allow and send' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); });
    await expect(answer).resolves.toBe(false);
  });

  it('resolves true on "Allow and send", then takes its dialog and its div away', async () => {
    const { answer } = await ask();
    expect(hosts().length).toBe(1);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Allow and send' })); });
    await expect(answer).resolves.toBe(true);
    await waitFor(() => expect(hosts().length).toBe(0));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('resolves false on Cancel, and removes the div', async () => {
    const { answer } = await ask();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); });
    await expect(answer).resolves.toBe(false);
    await waitFor(() => expect(hosts().length).toBe(0));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('resolves false on Escape, and removes the div', async () => {
    const { answer } = await ask();
    await act(async () => { fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape', code: 'Escape' }); });
    await expect(answer).resolves.toBe(false);
    await waitFor(() => expect(hosts().length).toBe(0));
  });

  it('asks every time: an earlier yes is not kept', async () => {
    const { answer: first } = await ask();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Allow and send' })); });
    await expect(first).resolves.toBe(true);
    await waitFor(() => expect(hosts().length).toBe(0));

    const { answer: second } = await ask();
    // The second question is on screen and unanswered.
    let settled = false;
    second.then(() => { settled = true; });
    await act(async () => { await Promise.resolve(); });
    expect(settled).toBe(false);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); });
    await expect(second).resolves.toBe(false);
  });

  it('a second tap cannot turn a no into a yes', async () => {
    const { answer } = await ask();
    const allow = screen.getByRole('button', { name: 'Allow and send' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      fireEvent.click(allow);
    });
    await expect(answer).resolves.toBe(false);
  });
});
