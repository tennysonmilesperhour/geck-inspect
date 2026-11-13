import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { presentMorphIdError } from '../morphIdErrors';
import { grantAiConsent, hasAiConsent, requireAiConsent, requireAiConsentInApp } from '../aiConsent';
import { recognizeGeckoMorph } from '../../functions/recognizeGeckoMorph';
import { runHealthScreen } from '../healthScreen';
import { InvokeLLM } from '../invokeLlm';
import { findSimilar } from '../visualSearch';
import { supabase } from '../supabaseClient';

// The in-app dialog (src/lib/aiConsentDialog.jsx) is stood in for by a
// function that answers no unless a test says otherwise. Its own test is
// aiConsentDialog.test.jsx.
const dialog = vi.hoisted(() => ({ ask: null }));
vi.mock('@/lib/aiConsentDialog', () => ({ askAiConsent: (...args) => dialog.ask(...args) }));

vi.mock('@/lib/supabaseClient', () => ({ supabase: { functions: { invoke: vi.fn() }, rpc: vi.fn(), from: vi.fn() } }));
beforeEach(() => {
  vi.stubGlobal('window', { confirm: vi.fn(() => false) });
  dialog.ask = vi.fn(async () => false);
  supabase.functions.invoke.mockReset();
  // Visual search: no match yet, and the photo has a row to embed.
  supabase.rpc.mockReset().mockResolvedValue({ data: [], error: null });
  supabase.from.mockReset().mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'img-1' }, error: null }) }) }),
  });
});
afterEach(() => vi.unstubAllGlobals());

const features = [
  ['recognize-gecko-morph', 'Anthropic', 'Replicate', 'photos'],
  ['health-screen', 'Anthropic', 'weight'],
  ['invoke-llm', 'Anthropic', 'conversation history'],
  ['generate-social-post', 'Anthropic', 'business profile'],
  ['recognize-import-data', 'Anthropic', 'personal information'],
  ['embed-gecko-image', 'Replicate', 'photo'],
];

describe('AI data sharing permission', () => {
  it.each(features)('discloses the data and provider for %s', (feature, ...words) => {
    expect(() => requireAiConsent(feature)).toThrow('Nothing was sent');
    const prompt = window.confirm.mock.calls[0][0];
    for (const word of words) expect(prompt).toContain(word);
    expect(prompt).toContain('Cancel');
  });
  it('does not silently reuse an earlier approval', () => {
    window.confirm.mockReturnValueOnce(true).mockReturnValueOnce(false);
    expect(() => requireAiConsent('health-screen')).not.toThrow();
    expect(() => requireAiConsent('health-screen')).toThrow();
    expect(window.confirm).toHaveBeenCalledTimes(2);
  });
  it('fails closed without a prompt or a known disclosure', () => {
    vi.stubGlobal('window', undefined);
    expect(() => requireAiConsent('health-screen')).toThrow();
    expect(() => requireAiConsent('unknown')).toThrow('Unknown AI');
  });
  it('never invokes paid AI endpoints when permission is declined', async () => {
    await expect(recognizeGeckoMorph({ imageUrl: 'https://example.com/gecko.jpg' })).resolves.toMatchObject({ error: { code: 'ai_consent_declined' } });
    await expect(InvokeLLM({ prompt: 'Gecko care question' })).rejects.toMatchObject({ code: 'ai_consent_declined' });
    const health = await runHealthScreen({ image_urls: ['https://example.com/gecko.jpg'] });
    expect(health.ok).toBe(false);
    expect(health.error).toContain('Nothing was sent');
    await expect(findSimilar('https://example.com/gecko.jpg')).resolves.toEqual([]);
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    // The text request, the health screen and visual search asked in the
    // app; Morph ID without an in-page yes asked the browser. All said no.
    expect(dialog.ask).toHaveBeenCalledTimes(3);
    expect(window.confirm).toHaveBeenCalledTimes(1);
  });
  it('shows cancellation without claiming an analyzer failure', () => {
    expect(presentMorphIdError({ code: 'ai_consent_declined' })).toMatchObject({ title: 'AI request canceled', retryable: false });
  });
  it('an in-page yes covers its own feature and request only, and never asks the browser', () => {
    const grant = grantAiConsent('recognize-gecko-morph', 'key-1');
    expect(hasAiConsent(grant, 'recognize-gecko-morph', 'key-1')).toBe(true);
    expect(hasAiConsent(grant, 'recognize-gecko-morph', 'key-2')).toBe(false);
    expect(hasAiConsent(grant, 'health-screen', 'key-1')).toBe(false);
    // Only grants made here count, so a look-alike object fails closed.
    expect(hasAiConsent({ feature: 'recognize-gecko-morph', scope: 'key-1' }, 'recognize-gecko-morph', 'key-1')).toBe(false);
    expect(() => requireAiConsent('recognize-gecko-morph', { grant, scope: 'key-1' })).not.toThrow();
    expect(() => requireAiConsent('recognize-gecko-morph', { grant, scope: 'key-2' })).toThrow('Nothing was sent');
    expect(() => requireAiConsent('recognize-gecko-morph', { grant: null, scope: 'key-1' })).toThrow('Nothing was sent');
    expect(window.confirm).not.toHaveBeenCalled();
    expect(() => grantAiConsent('unknown', 'key-1')).toThrow('Unknown AI');
    expect(() => grantAiConsent('recognize-gecko-morph', '')).toThrow();
  });
  it('Morph ID with an in-page yes sends only the request it was given for', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { analysis: { morph: 'Harlequin' } }, error: null });
    const grant = grantAiConsent('recognize-gecko-morph', 'key-1');
    const refused = await recognizeGeckoMorph({ imageUrl: 'https://example.com/gecko.jpg', requestKey: 'key-2', consent: grant });
    expect(refused.error.code).toBe('ai_consent_declined');
    const noYes = await recognizeGeckoMorph({ imageUrl: 'https://example.com/gecko.jpg', requestKey: 'key-1', consent: null });
    expect(noYes.error.code).toBe('ai_consent_declined');
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    const sent = await recognizeGeckoMorph({ imageUrl: 'https://example.com/gecko.jpg', requestKey: 'key-1', consent: grant });
    expect(sent.data.morph).toBe('Harlequin');
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
    // The in-page step replaces the confirm box; it is never shown on top.
    expect(window.confirm).not.toHaveBeenCalled();
  });
  describe('asked in the app (requireAiConsentInApp)', () => {
    it.each(features)('discloses the data and provider for %s', async (feature, ...words) => {
      await expect(requireAiConsentInApp(feature)).rejects.toMatchObject({
        code: 'ai_consent_declined',
        message: expect.stringContaining('Nothing was sent'),
      });
      expect(dialog.ask).toHaveBeenCalledTimes(1);
      const disclosure = dialog.ask.mock.calls[0][0];
      for (const word of words) expect(disclosure).toContain(word);
      // The app's own dialog asked, so the browser's box did not.
      expect(window.confirm).not.toHaveBeenCalled();
    });
    it('a no sends nothing, even where the browser box would have said yes', async () => {
      window.confirm.mockReturnValue(true);
      await expect(InvokeLLM({ prompt: 'Gecko care question' })).rejects.toMatchObject({ code: 'ai_consent_declined' });
      const health = await runHealthScreen({ image_urls: ['https://example.com/gecko.jpg'] });
      expect(health.ok).toBe(false);
      expect(health.error).toContain('Nothing was sent');
      await expect(findSimilar('https://example.com/gecko.jpg')).resolves.toEqual([]);
      expect(dialog.ask).toHaveBeenCalledTimes(3);
      expect(supabase.functions.invoke).not.toHaveBeenCalled();
      expect(window.confirm).not.toHaveBeenCalled();
    });
    it('only a plain yes counts', async () => {
      for (const answer of [undefined, null, 0, '', 'yes', 1, {}]) {
        dialog.ask.mockResolvedValueOnce(answer);
        await expect(requireAiConsentInApp('health-screen')).rejects.toMatchObject({ code: 'ai_consent_declined' });
      }
      expect(window.confirm).not.toHaveBeenCalled();
    });
    it('a yes sends the request, once, unchanged', async () => {
      dialog.ask.mockResolvedValue(true);
      supabase.functions.invoke.mockResolvedValue({ data: { text: 'Feed every other day.' }, error: null });
      await expect(InvokeLLM({ prompt: 'Gecko care question' })).resolves.toBe('Feed every other day.');
      expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('invoke-llm', { body: { prompt: 'Gecko care question' } });
      expect(dialog.ask).toHaveBeenCalledTimes(1);
      expect(dialog.ask.mock.calls[0][0]).toContain('Anthropic');
    });
    it('a yes sends the health screen and the visual search request', async () => {
      dialog.ask.mockResolvedValue(true);
      supabase.functions.invoke.mockResolvedValue({ data: { observations: [], persisted: true }, error: null });
      const health = await runHealthScreen({ image_urls: ['https://example.com/gecko.jpg'], name: 'Onyx' });
      expect(health.ok).toBe(true);
      await findSimilar('https://example.com/gecko.jpg');
      expect(supabase.functions.invoke.mock.calls.map((call) => call[0])).toEqual(['health-screen', 'embed-gecko-image']);
      expect(dialog.ask).toHaveBeenCalledTimes(2);
    });
    it('does not silently reuse an earlier approval', async () => {
      dialog.ask.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      await expect(requireAiConsentInApp('health-screen')).resolves.toBeUndefined();
      await expect(requireAiConsentInApp('health-screen')).rejects.toMatchObject({ code: 'ai_consent_declined' });
      expect(dialog.ask).toHaveBeenCalledTimes(2);
    });
    it('an unknown feature throws and never asks', async () => {
      dialog.ask.mockResolvedValue(true);
      await expect(requireAiConsentInApp('unknown')).rejects.toThrow('Unknown AI');
      await expect(requireAiConsentInApp()).rejects.toThrow('Unknown AI');
      expect(dialog.ask).not.toHaveBeenCalled();
      expect(window.confirm).not.toHaveBeenCalled();
    });
    it('a grant must match or it fails closed, and never asks', async () => {
      dialog.ask.mockResolvedValue(true);
      window.confirm.mockReturnValue(true);
      const grant = grantAiConsent('health-screen', 'key-1');
      await expect(requireAiConsentInApp('health-screen', { grant, scope: 'key-1' })).resolves.toBeUndefined();
      await expect(requireAiConsentInApp('health-screen', { grant, scope: 'key-2' })).rejects.toMatchObject({ code: 'ai_consent_declined' });
      await expect(requireAiConsentInApp('invoke-llm', { grant, scope: 'key-1' })).rejects.toMatchObject({ code: 'ai_consent_declined' });
      await expect(requireAiConsentInApp('health-screen', { grant: null, scope: 'key-1' })).rejects.toMatchObject({ code: 'ai_consent_declined' });
      await expect(requireAiConsentInApp('health-screen', { grant: { feature: 'health-screen', scope: 'key-1' }, scope: 'key-1' })).rejects.toMatchObject({ code: 'ai_consent_declined' });
      expect(dialog.ask).not.toHaveBeenCalled();
      expect(window.confirm).not.toHaveBeenCalled();
    });
    it('asks with the browser box when the dialog cannot be shown, and still needs a yes', async () => {
      dialog.ask.mockRejectedValue(new Error('no page to draw on'));
      await expect(requireAiConsentInApp('health-screen')).rejects.toMatchObject({ code: 'ai_consent_declined' });
      expect(window.confirm).toHaveBeenCalledTimes(1);
      expect(window.confirm.mock.calls[0][0]).toContain('Anthropic');
      expect(window.confirm.mock.calls[0][0]).toContain('Cancel');
      window.confirm.mockReturnValueOnce(true);
      await expect(requireAiConsentInApp('health-screen')).resolves.toBeUndefined();
      // Neither way to ask is there: nothing is sent.
      vi.stubGlobal('window', undefined);
      await expect(requireAiConsentInApp('health-screen')).rejects.toMatchObject({ code: 'ai_consent_declined' });
    });
    it('asks with the browser box when the dialog file cannot be loaded', async () => {
      vi.resetModules();
      vi.doMock('@/lib/aiConsentDialog', () => { throw new Error('Failed to fetch dynamically imported module'); });
      try {
        const fresh = await import('../aiConsent');
        await expect(fresh.requireAiConsentInApp('invoke-llm')).rejects.toMatchObject({ code: 'ai_consent_declined' });
        expect(window.confirm).toHaveBeenCalledTimes(1);
        window.confirm.mockReturnValueOnce(true);
        await expect(fresh.requireAiConsentInApp('invoke-llm')).resolves.toBeUndefined();
        expect(dialog.ask).not.toHaveBeenCalled();
      } finally {
        vi.doUnmock('@/lib/aiConsentDialog');
        vi.resetModules();
      }
    });
  });
  it('sends the unchanged payload only after approval', async () => {
    window.confirm.mockReturnValue(true);
    supabase.functions.invoke.mockResolvedValue({ data: { analysis: { morph: 'Harlequin' } }, error: null });
    const result = await recognizeGeckoMorph({ imageUrl: 'https://example.com/gecko.jpg' });
    expect(result.data.morph).toBe('Harlequin');
    expect(supabase.functions.invoke).toHaveBeenCalledWith('recognize-gecko-morph', { body: { imageUrls: ['https://example.com/gecko.jpg'] } });
  });
});
