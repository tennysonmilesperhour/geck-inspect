// Public waitlist signups go through the waitlist-signup edge function
// (audit step 33): it records the signup, emails a confirmation link,
// and once the link is opened emails the buyer their place in line and
// the deposit terms they agreed to.

// The function answers errors with { error } and a non-2xx status;
// supabase-js hides the body inside error.context.
async function edgeErrorMessage(error, fallback) {
  const ctx = error?.context;
  if (ctx && typeof ctx.text === 'function') {
    try {
      const body = await ctx.text();
      if (body) {
        try { return JSON.parse(body)?.error || fallback; } catch { return body; }
      }
    } catch { /* fall through */ }
  }
  return error?.message || fallback;
}

async function call(supabase, body, fallback) {
  const { data, error } = await supabase.functions.invoke('waitlist-signup', { body });
  if (error) throw new Error(await edgeErrorMessage(error, fallback));
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Sign up; resolves once the confirmation email is on its way. */
export function joinWaitlist(supabase, { slug, name, email, wanted, notes, acceptTerms }) {
  return call(supabase, {
    action: 'join',
    slug,
    name: name.trim(),
    email: email.trim(),
    wanted: wanted || null,
    notes: notes?.trim() || null,
    accept_terms: Boolean(acceptTerms),
  }, 'Signup failed.');
}

/** Open the emailed link. Resolves to { position, title, terms, ... }. */
export function confirmWaitlist(supabase, token) {
  return call(supabase, { action: 'confirm', token }, 'This confirmation link is invalid or has expired.');
}

/** The ?confirm= token from the emailed link, if it looks right. */
export function confirmTokenFromSearch(search) {
  const token = new URLSearchParams(search || '').get('confirm');
  return token && /^[0-9a-f]{64}$/.test(token) ? token : null;
}
