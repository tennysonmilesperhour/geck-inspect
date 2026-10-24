import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
// Loaded on first use, not with the page (src/lib/supabaseLazy.js).
import { getSupabase } from '@/lib/supabaseLazy';
import { captureEvent } from '@/lib/posthog';

/**
 * Weekly Gecko Notes for visitors who are not ready for an account: one
 * short crested gecko tip a week by email (docs/planning/weekly-notes-2026-10.md,
 * section 9).
 *
 * It posts to the subscribe-weekly-notes function, which emails a
 * confirmation link. Nothing is sent after that until the visitor presses
 * the button on /WeeklyNotes?t=..., so a typo or a stranger's address
 * never ends up on the list. The reply is the same whether the address is
 * new, already signed up or has an account (the email says which).
 *
 * ContentSignupPrompt loads this lazily under the account prompt on the
 * public guide pages, so it costs those pages nothing until it is on
 * screen. The /WeeklyNotes page uses it directly. Analytics get the page
 * and the prompt id, never the address.
 */
const FALLBACK_ERROR = 'Could not sign you up right now. Please try again later.';

export default function WeeklyNotesSignup({ source = 'form', page = '', framed = true }) {
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  // idle, sending, sent (check your inbox) or recent (emailed today already)
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const id = useId();

  const submit = async (e) => {
    e.preventDefault();
    if (state === 'sending') return;
    const value = email.trim();
    if (!value) {
      setError('Please enter your email.');
      return;
    }
    setError('');
    setState('sending');
    try {
      const supabase = await getSupabase();
      const { data, error: fnErr } = await supabase.functions.invoke('subscribe-weekly-notes', {
        body: { email: value, source, website },
      });
      if (fnErr) {
        // A refusal (a bad address, too many from one network) carries its
        // reason in the body, which invoke() does not parse.
        let reason = '';
        try {
          if (typeof fnErr.context?.json === 'function') reason = (await fnErr.context.json())?.error || '';
        } catch {
          reason = '';
        }
        throw new Error(reason || FALLBACK_ERROR);
      }
      if (data?.error) throw new Error(data.error);
      captureEvent('weekly_notes_signup_submitted', { source, page });
      setState(data?.recently_sent ? 'recent' : 'sent');
    } catch (err) {
      setError(err?.message || FALLBACK_ERROR);
      setState('idle');
    }
  };

  const done = state === 'sent' || state === 'recent';

  return (
    <div className={framed ? 'mt-5 pt-5 border-t border-emerald-500/20' : ''}>
      <h3 className="text-base font-semibold text-white leading-snug">
        Not ready for an account? Get one crested gecko tip a week.
      </h3>
      <p className="mt-1 text-sm text-slate-300 leading-relaxed max-w-2xl">
        Weekly Gecko Notes: short, practical notes on heat, weights, feeding, het labels and pairings.
        Free. We email you a link to confirm first, and every note has a link that stops them.
      </p>
      <div aria-live="polite" role="status">
        {done && (
          <p className="mt-3 text-sm text-emerald-200">
            {state === 'recent'
              ? 'We already emailed this address today. Look for the link in your inbox, and in spam.'
              : 'Check your inbox. Tap the link in the email from Geck Inspect to confirm, and the notes start. Not there? Check spam.'}
          </p>
        )}
      </div>
      {!done && (
        <form onSubmit={submit} className="mt-3 flex flex-col sm:flex-row gap-2 max-w-xl" noValidate>
          <label htmlFor={`${id}-email`} className="sr-only">Email address</label>
          <input
            id={`${id}-email`}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            maxLength={254}
            autoComplete="email"
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className="min-w-0 flex-1 rounded-md border border-slate-600 bg-slate-950/60 px-3 min-h-11 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {/* Honeypot: hidden from people and screen readers. */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
            <label>
              Website (leave blank)
              <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
          </div>
          <button
            type="submit"
            disabled={state === 'sending'}
            className="inline-flex items-center justify-center rounded-md border border-emerald-500/60 bg-slate-900 hover:bg-slate-800 text-emerald-100 font-semibold px-4 min-h-11 text-sm transition-colors disabled:opacity-60"
          >
            {state === 'sending' ? 'Sending...' : 'Send me the notes'}
          </button>
        </form>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-2 text-sm text-amber-300" role="alert">{error}</p>
      )}
      <p className="mt-2 text-xs text-slate-400">
        Your address is used only for Weekly Gecko Notes.{' '}
        <Link to="/PrivacyPolicy" className="underline underline-offset-2 hover:text-slate-200">Privacy Policy</Link>
      </p>
    </div>
  );
}
