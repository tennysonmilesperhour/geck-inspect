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
 *   const { text, credits } = await askConsultant({ question, history, geckoNames, facts });
 *
 * Errors carry `code`: 'credits_exhausted' (monthly assistant allotment
 * used up, `included` holds the allotment when known), 'unauthenticated',
 * or 'refused' (the model declined the question; retrying will not help).
 * When the AI call itself fails, the server refunds the credit and the
 * error carries `refunded: true` and the updated `credits`.
 */
import { supabase } from '@/lib/supabaseClient';

async function callInvokeLlm(body) {
  const { data, error } = await supabase.functions.invoke('invoke-llm', { body });

  if (error) {
    // Supabase's FunctionsHttpError usually hides the actual body. Pull it.
    const ctx = error.context;
    const status = ctx && typeof ctx.status === 'number' ? ctx.status : null;
    let detail = error.message;
    if (ctx && typeof ctx.text === 'function') {
      try {
        const text = await ctx.text();
        detail = text || detail;
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
    err.serverError = parsed?.error ?? null;
    if (status === 402 || parsed?.error === 'feature_credits_exhausted') {
      err.code = 'credits_exhausted';
      err.included = parsed?.included ?? null;
    } else if (status === 401 || parsed?.error === 'unauthenticated') {
      err.code = 'unauthenticated';
    } else if (parsed?.code === 'refused') {
      err.code = 'refused';
    }
    // A failed AI call gives the credit back on the server; pass that on
    // so the page can keep its "messages left" count right.
    if (parsed?.refunded) err.refunded = true;
    if (parsed?.credits) err.credits = parsed.credits;
    throw err;
  }
  if (data?.error) {
    const err = new Error(data.error);
    if (data.error === 'feature_credits_exhausted') err.code = 'credits_exhausted';
    throw err;
  }
  return data || {};
}

function promptBody({ prompt, response_json_schema, model, max_tokens } = {}) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('InvokeLLM: prompt is required');
  }
  return { prompt, response_json_schema, model, max_tokens };
}

export async function InvokeLLMDetailed(opts = {}) {
  const data = await callInvokeLlm(promptBody(opts));
  return { text: data.text || '', json: data.json, credits: data.credits || null };
}

export async function InvokeLLM(opts = {}) {
  const data = await callInvokeLlm(promptBody(opts));
  if (opts.response_json_schema) {
    if (data.json === undefined) {
      throw new Error('invoke-llm returned no JSON payload');
    }
    return data.json;
  }
  return data.text || '';
}

/**
 * The request body for one GeckoGenius chat turn. Only data: the persona,
 * the care and genetics rules and the record actions live on the server
 * (supabase/functions/invoke-llm/consultant.ts), so nothing here can
 * change them.
 *
 * @param {object} opts
 * @param {string} opts.question - what the member just typed
 * @param {{ role: 'user' | 'assistant', content: string }[]} [opts.history] - recent turns, oldest first
 * @param {string[]} [opts.geckoNames] - the member's gecko names, for the record actions
 * @param {string} [opts.facts] - the calculator and value-table block (consultantContext.js)
 */
export function consultantBody({ question, history = [], geckoNames = [], facts = '' } = {}) {
  if (!question || typeof question !== 'string') {
    throw new Error('askConsultant: question is required');
  }
  return {
    mode: 'consultant',
    question,
    history: (Array.isArray(history) ? history : [])
      .filter((t) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string' && t.content.trim())
      .map((t) => ({ role: t.role, content: t.content })),
    gecko_names: (Array.isArray(geckoNames) ? geckoNames : []).filter((n) => typeof n === 'string' && n.trim()),
    facts: typeof facts === 'string' ? facts : '',
  };
}

/**
 * The same turn as one plain prompt, for an invoke-llm deployed before the
 * consultant mode existed (it answers a consultant body with "prompt is
 * required", before taking a credit). Only data goes in it: that older
 * function adds its own one-line system prompt, and the current one adds
 * the GeckoGenius rules to every member prompt. Remove once every
 * environment runs the 16 Oct 2026 function.
 */
export function legacyConsultantPrompt(body) {
  const lines = (body.history || []).map((t) => `${t.role === 'user' ? 'Member' : 'GeckoGenius'}: ${t.content}`);
  const parts = [];
  if (lines.length) parts.push(`The conversation so far:\n${lines.join('\n\n')}`);
  if (body.facts) parts.push(body.facts);
  parts.push(`Member: ${body.question}`);
  return parts.join('\n\n');
}

/** One GeckoGenius chat turn. Resolves to { text, credits }. */
export async function askConsultant(opts = {}) {
  const body = consultantBody(opts);
  let data;
  try {
    data = await callInvokeLlm(body);
  } catch (err) {
    if (err?.serverError !== 'prompt is required') throw err;
    data = await callInvokeLlm({ prompt: legacyConsultantPrompt(body) });
  }
  return { text: data.text || '', credits: data.credits || null };
}
