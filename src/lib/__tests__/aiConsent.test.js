import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { presentMorphIdError } from '../morphIdErrors';
import { requireAiConsent } from '../aiConsent';
import { recognizeGeckoMorph } from '../../functions/recognizeGeckoMorph';
import { runHealthScreen } from '../healthScreen';
import { InvokeLLM } from '../invokeLlm';
import { supabase } from '../supabaseClient';

vi.mock('@/lib/supabaseClient', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
beforeEach(() => {
  vi.stubGlobal('window', { confirm: vi.fn(() => false) });
  supabase.functions.invoke.mockReset();
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
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });
  it('shows cancellation without claiming an analyzer failure', () => {
    expect(presentMorphIdError({ code: 'ai_consent_declined' })).toMatchObject({ title: 'AI request canceled', retryable: false });
  });
  it('sends the unchanged payload only after approval', async () => {
    window.confirm.mockReturnValue(true);
    supabase.functions.invoke.mockResolvedValue({ data: { analysis: { morph: 'Harlequin' } }, error: null });
    const result = await recognizeGeckoMorph({ imageUrl: 'https://example.com/gecko.jpg' });
    expect(result.data.morph).toBe('Harlequin');
    expect(supabase.functions.invoke).toHaveBeenCalledWith('recognize-gecko-morph', { body: { imageUrls: ['https://example.com/gecko.jpg'] } });
  });
});
