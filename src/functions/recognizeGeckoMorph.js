import { supabase } from '@/lib/supabaseClient';

// Calls the Supabase edge function `recognize-gecko-morph`, which proxies
// to an open-weights VLM (Qwen2.5-VL via Replicate by default) and clamps
// the output to our canonical taxonomy. Takes { imageUrl } — the caller
// must have uploaded the image first (Recognition.jsx does this).
export async function recognizeGeckoMorph({ imageUrl } = {}) {
  if (!imageUrl) {
    return { data: null, error: new Error('imageUrl is required') };
  }
  const { data, error } = await supabase.functions.invoke('recognize-gecko-morph', {
    body: { imageUrl },
  });
  if (error) {
    // Supabase wraps the body inside `error.context` on non-2xx responses.
    let detail = error.message;
    const ctx = error.context;
    if (ctx && typeof ctx.text === 'function') {
      try { detail = (await ctx.text()) || detail; } catch { /* ignore */ }
    }
    return { data: null, error: new Error(detail) };
  }
  if (data?.error) {
    return { data: null, error: new Error(data.error) };
  }
  return { data: data?.analysis || data, error: null };
}
