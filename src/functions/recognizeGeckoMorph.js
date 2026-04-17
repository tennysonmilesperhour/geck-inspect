import { supabase } from '@/lib/supabaseClient';

// Calls the Supabase edge function `recognize-gecko-morph`, which routes
// to Claude vision and clamps the output to our canonical taxonomy.
//
// Accepts either { imageUrl: string } or { imageUrls: string[] } (up to 5).
// Claude synthesizes across multiple photos of the same gecko.
export async function recognizeGeckoMorph({ imageUrl, imageUrls } = {}) {
  const urls = Array.isArray(imageUrls) && imageUrls.length
    ? imageUrls
    : imageUrl ? [imageUrl] : [];
  if (urls.length === 0) {
    return { data: null, error: new Error('imageUrl(s) required') };
  }

  const { data, error } = await supabase.functions.invoke('recognize-gecko-morph', {
    body: { imageUrls: urls },
  });
  if (error) {
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
