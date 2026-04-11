/**
 * InvokeLLM — client wrapper for the `invoke-llm` Supabase edge function.
 *
 * Replaces the Base44 `base44.integrations.Core.InvokeLLM` API (which is
 * dead because Base44 shut down) with a Supabase-backed equivalent. The
 * edge function stores the ANTHROPIC_API_KEY server-side and proxies to
 * Anthropic's Messages API.
 *
 * Usage (matches the old Base44 shape so existing callers keep working):
 *   const result = await InvokeLLM({
 *     prompt: '...',
 *     response_json_schema: { type: 'object', properties: {...} },
 *   });
 *
 * - With a response_json_schema: resolves to the parsed JSON object.
 * - Without a schema: resolves to a plain string.
 *
 * Throws if the edge function returns a non-200 or the LLM fails.
 */
import { supabase } from '@/lib/supabaseClient';

export async function InvokeLLM({ prompt, response_json_schema, model, max_tokens } = {}) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('InvokeLLM: prompt is required');
  }

  const { data, error } = await supabase.functions.invoke('invoke-llm', {
    body: { prompt, response_json_schema, model, max_tokens },
  });

  if (error) {
    // Supabase's FunctionsHttpError usually hides the actual body. Pull it.
    const ctx = error.context;
    let detail = error.message;
    if (ctx && typeof ctx.text === 'function') {
      try {
        const body = await ctx.text();
        detail = body || detail;
      } catch {
        // ignore
      }
    }
    throw new Error(`invoke-llm failed: ${detail}`);
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  if (response_json_schema) {
    if (data?.json === undefined) {
      throw new Error('invoke-llm returned no JSON payload');
    }
    return data.json;
  }
  return data?.text || '';
}
