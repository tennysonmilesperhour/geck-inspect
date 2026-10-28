import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Morph ID's permission step, on the page, before anything is sent to an
 * AI provider. It replaced the browser's confirm box (28 Oct 2026), which
 * the iPhone app's web view does not reliably show and which read as a
 * wall of legal text. The promise is the one in the Privacy Policy (Third-
 * Party Services): it names what is sent and to whom, nothing goes until
 * the member taps Allow and identify, and the yes covers this one set of
 * photos only. New photos ask again; nothing is stored.
 *
 * Props: onAllow(), onDecline(), disabled (photos still uploading).
 */
export default function AiConsentPanel({ onAllow, onDecline, disabled = false }) {
  const headingRef = useRef(null);

  // Move focus here when the step opens, so keyboard and screen reader
  // users land on the question instead of the button that opened it.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby="morph-ai-consent-title"
      className="rounded-xl border border-emerald-600/60 bg-slate-900/90 p-4 space-y-3 max-w-xl"
    >
      <h3
        id="morph-ai-consent-title"
        ref={headingRef}
        tabIndex={-1}
        className="font-semibold text-slate-100 flex items-center gap-2 focus:outline-none"
      >
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
        Before we send your photos
      </h3>
      <ul className="text-sm text-slate-300 space-y-1.5 list-disc pl-5">
        <li>Your photos, with the life stage and fired state you picked, go to Anthropic, the AI that reads the morph.</li>
        <li>When visual comparison is on, the photos also go to Replicate, which finds the closest breeder-tagged reference photos.</li>
        <li>Only send photos you have permission to share.</li>
      </ul>
      <p className="text-xs text-slate-400">
        Nothing is sent until you tap Allow and identify, and we ask again for every new set of photos.{' '}
        {/* The in-app route, as the iPhone app's membership screen links
            it, so the policy opens inside the app instead of sending the
            member out to Safari in the middle of this step. */}
        <Link
          to="/PrivacyPolicy"
          className="text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
        >
          Privacy Policy, Third-Party Services
        </Link>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="lg" onClick={onAllow} disabled={disabled} className="bg-emerald-600 hover:bg-emerald-700">
          <Sparkles className="mr-2 h-5 w-5" aria-hidden="true" /> Allow and identify
        </Button>
        <Button size="lg" variant="outline" onClick={onDecline}>
          Not now
        </Button>
      </div>
    </section>
  );
}
