import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Send, CheckCircle, Loader2, BookOpen, Dna, Mail } from 'lucide-react';

/**
 * Lead-magnet email capture rendered on the public landing page.
 * Submits to the `subscribe-and-send-guides` edge function which
 * records the subscriber and emails them PDF download links for
 * the Care Guide and Genetics Guide via Resend.
 *
 * Pure client component — no auth required.
 */
export default function EmailCaptureCard({ source = 'homepage' }) {
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('subscribe-and-send-guides', {
        body: { email: email.trim(), source, website },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setSubmitted(true);
    } catch (err) {
      console.warn('Email capture failed:', err);
      setError(err.message || 'Could not subscribe. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="relative z-10 max-w-4xl mx-auto px-6 pb-24">
      <div className="rounded-lg border border-emerald-500/30 bg-gradient-to-br from-emerald-950/50 via-slate-900/70 to-slate-900/40 backdrop-blur p-6 md:p-10 shadow-2xl shadow-emerald-500/10">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-4">
              <Mail className="w-3.5 h-3.5" />
              Free guides
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Get the Genetics Guide and Care Guide.
              <br className="hidden md:block" />
              <span className="text-emerald-300">Free PDFs, sent to your inbox.</span>
            </h2>
            <p className="text-slate-300 leading-relaxed mb-5">
              Two written-by-a-breeder PDFs covering the full crested gecko hobby — husbandry from hatchling to senior, plus a complete genetics primer with punnett projections, polygenic traits, and a glossary of every term that matters. No spam. Unsubscribe any time.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <div className="flex items-start gap-3 rounded border border-emerald-500/20 bg-emerald-950/30 px-4 py-3">
                <BookOpen className="w-5 h-5 text-emerald-300 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-white">Care Guide</div>
                  <div className="text-xs text-slate-400 leading-snug">Housing, diet, handling, health, life stages, breeding.</div>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded border border-emerald-500/20 bg-emerald-950/30 px-4 py-3">
                <Dna className="w-5 h-5 text-emerald-300 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-white">Genetics Guide</div>
                  <div className="text-xs text-slate-400 leading-snug">Punnetts, polygenic traits, lethal alleles, full glossary.</div>
                </div>
              </div>
            </div>

            {submitted ? (
              <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 inline-flex items-center gap-3 text-emerald-200">
                <CheckCircle className="w-5 h-5" />
                <div className="text-sm">
                  Sent. Check your inbox for both download links — including spam, just in case.
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 rounded bg-slate-900/80 border border-slate-700 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                  maxLength={254}
                  autoComplete="email"
                />

                {/* Honeypot */}
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

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-700/50 px-5 py-3 text-sm font-semibold text-white transition-colors"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send me the guides
                    </>
                  )}
                </button>
              </form>
            )}

            {error && !submitted && (
              <div className="mt-3 text-xs text-red-300">{error}</div>
            )}

            <p className="mt-3 text-[11px] text-slate-500">
              Already a member? Both guides are also linked from <a href="/CareGuide" className="underline hover:text-slate-300">Care Guide</a> and <a href="/GeneticsGuide" className="underline hover:text-slate-300">Genetics Guide</a>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
