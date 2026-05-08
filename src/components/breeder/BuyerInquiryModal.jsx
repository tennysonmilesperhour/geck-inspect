import { useState, useEffect } from 'react';
import { X, Send, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Buyer-side inquiry modal rendered on the public breeder storefront
 * (/Breeder/:slug). Anyone (logged-in or not) can submit an inquiry —
 * the form posts to the `send-breeder-inquiry` edge function which
 * records it in `breeder_inquiries` and emails the breeder via Resend.
 *
 * Props:
 *   - open: boolean
 *   - onClose: () => void
 *   - breederEmail: string (required, recipient)
 *   - breederSlug?: string (used in the email link back)
 *   - breederName?: string (display only)
 *   - gecko?: { id, name, passport_code } (optional — populated when
 *             inquiring about a specific listing)
 *
 * The form has a hidden honeypot field `website` that real users won't
 * fill in; the edge function silently drops submissions where it's set.
 */
export default function BuyerInquiryModal({
  open,
  onClose,
  breederEmail,
  breederSlug,
  breederName,
  gecko,
}) {
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    // Reset form state when re-opened.
    setSubmitted(false);
    setError('');
  }, [open]);

  if (!open) return null;

  const subjectPrefix = gecko?.name
    ? `I'm interested in ${gecko.name}.\n\n`
    : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!buyerEmail.trim() || !message.trim()) {
      setError('Email and message are required.');
      return;
    }
    if (message.trim().length < 4) {
      setError('Please write a bit more in your message.');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('send-breeder-inquiry', {
        body: {
          breeder_email: breederEmail,
          breeder_slug: breederSlug || '',
          buyer_email: buyerEmail.trim(),
          buyer_name: buyerName.trim(),
          buyer_phone: buyerPhone.trim(),
          gecko_id: gecko?.id || '',
          gecko_name: gecko?.name || '',
          gecko_passport_code: gecko?.passport_code || '',
          message: message.trim(),
          website, // honeypot — should be empty
        },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setSubmitted(true);
    } catch (err) {
      console.warn('Inquiry submission failed:', err);
      setError(err.message || 'Could not send inquiry. Please try again or email the breeder directly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-emerald-500/30 bg-slate-900 shadow-2xl shadow-emerald-500/10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Inquiry sent</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              {breederName || 'The breeder'} will get an email at{' '}
              <span className="text-emerald-300">{breederEmail}</span> and can reply directly to your address.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 md:p-7 space-y-4">
            <div>
              <h3 className="text-lg md:text-xl font-bold text-white">
                {gecko?.name ? `Inquire about ${gecko.name}` : `Contact ${breederName || 'breeder'}`}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {gecko?.name
                  ? 'Send a message and the breeder will reply directly to your email.'
                  : 'Send a message and the breeder will reply directly to your email.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Your name
                </label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                  placeholder="Optional"
                  maxLength={120}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  className="w-full rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                  placeholder="you@example.com"
                  maxLength={254}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Phone (optional)
              </label>
              <input
                type="tel"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                className="w-full rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                placeholder="If you'd prefer a call/text"
                maxLength={40}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Message <span className="text-emerald-400">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={message || subjectPrefix}
                onChange={(e) => setMessage(e.target.value)}
                onFocus={(e) => {
                  if (!message && subjectPrefix) {
                    setMessage(subjectPrefix);
                    requestAnimationFrame(() => {
                      e.target.setSelectionRange(subjectPrefix.length, subjectPrefix.length);
                    });
                  }
                }}
                className="w-full rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none resize-y"
                placeholder={gecko?.name
                  ? `Tell ${breederName || 'the breeder'} what you'd like to know about ${gecko.name} (availability, sex confirmation, holds, shipping, etc.)`
                  : 'Tell the breeder what you\'re looking for.'}
                maxLength={4000}
              />
            </div>

            {/* Honeypot — invisible to humans; bots fill every field. */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
              <label>
                Website (leave blank)
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </label>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-[11px] text-slate-500 leading-snug max-w-[28ch]">
                Your email will only be shared with this breeder so they can reply.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-700/50 text-white font-semibold text-sm transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send inquiry
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
