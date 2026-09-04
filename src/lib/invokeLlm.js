/**
 * InvokeLLM, client wrapper for the `invoke-llm` Supabase edge function.
 *
 * The function decides the model, the token budget, and (for keepers, not
 * admins) consumes one `assistant_message` credit per call. The browser
 * only sends the prompt.
 *
 * Usage:
 *   const text = await InvokeLLM({ prompt });
 *   const json = await InvokeLLM({ prompt, response_json_schema });
 *   const { text, credits } = await InvokeLLMDetailed({ prompt });
 *
 * Errors carry `code`: 'credits_exhausted' (monthly assistant allotment
 * used up, `included` holds the allotment when known) or 'unauthenticated'.
 */
import { supabase } from '@/lib/supabaseClient';

async function callInvokeLlm({ prompt, response_json_schema, model, max_tokens } = {}) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('InvokeLLM: prompt is required');
  }

  const { data, error } = await supabase.functions.invoke('invoke-llm', {
    body: { prompt, response_json_schema, model, max_tokens },
  });

  if (error) {
    // Supabase's FunctionsHttpError usually hides the actual body. Pull it.
    const ctx = error.context;
    const status = ctx && typeof ctx.status === 'number' ? ctx.status : null;
    let detail = error.message;
    if (ctx && typeof ctx.text === 'function') {
      try {
        const body = await ctx.text();
        detail = body || detail;
      } catch {
        // ignore
      }
    }
    let parsed = null;
    try {
      parsed = JSON.parse(detail);
    } catch {
      // not JSON, keep the raw text
    }
    const err = new Error(`invoke-llm failed: ${parsed?.error || detail}`);
    if (status === 402 || parsed?.error === 'feature_credits_exhausted') {
      err.code = 'credits_exhausted';
      err.included = parsed?.included ?? null;
    } else if (status === 401 || parsed?.error === 'unauthenticated') {
      err.code = 'unauthenticated';
    }
    throw err;
  }
  if (data?.error) {
    const err = new Error(data.error);
    if (data.error === 'feature_credits_exhausted') err.code = 'credits_exhausted';
    throw err;
  }
  return data || {};
}

export async function InvokeLLMDetailed(opts = {}) {
  const data = await callInvokeLlm(opts);
  return { text: data.text || '', json: data.json, credits: data.credits || null };
}

export async function InvokeLLM(opts = {}) {
  const data = await callInvokeLlm(opts);
  if (opts.response_json_schema) {
    if (data.json === undefined) {
      throw new Error('invoke-llm returned no JSON payload');
    }
    return data.json;
  }
  return data.text || '';
}
