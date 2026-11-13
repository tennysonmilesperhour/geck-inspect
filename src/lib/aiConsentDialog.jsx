// The in-app "may we send this to the AI provider?" dialog.
//
// The iPhone app's web view does not reliably show the browser's confirm
// box, so the AI features that asked with it failed there as "canceled".
// This shows the same question in the app's own dialog.
//
// Loaded only when a request is about to be sent: src/lib/aiConsent.js
// brings this file in with a dynamic import(), so nothing here is part
// of the code every page downloads. Do not import it up front.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

export const AI_CONSENT_TITLE = 'Send this to the AI provider?';
export const AI_CONSENT_NOTE = 'Only continue with photos and information you have permission to share. See Privacy Policy > Third-Party Services for details. Cancel keeps this request from being sent to AI providers.';

function AiConsentDialog({ disclosure, onAnswer }) {
  const [open, setOpen] = useState(true);
  const answer = (yes) => {
    setOpen(false);
    onAnswer(yes);
  };
  return (
    <ConfirmDialog
      open={open}
      // Cancel, Escape and any other way of closing are all a no.
      onOpenChange={(next) => { if (!next) answer(false); }}
      title={AI_CONSENT_TITLE}
      description={disclosure}
      confirmLabel="Allow and send"
      onConfirm={() => answer(true)}
    >
      <p className="text-xs text-slate-400">{AI_CONSENT_NOTE}</p>
    </ConfirmDialog>
  );
}

/**
 * Ask the member, in the app's own dialog, whether this request may be
 * sent. Resolves true only on "Allow and send"; Cancel, Escape and any
 * other dismissal resolve false. Nothing is remembered: every call asks.
 *
 * The dialog gets its own React root on a div added to the page, so a
 * plain function (not a component) can ask from anywhere.
 */
export function askAiConsent(disclosure) {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.setAttribute('data-ai-consent', '');
    document.body.appendChild(host);
    const root = createRoot(host);
    let answered = false;
    const onAnswer = (yes) => {
      if (answered) return;
      answered = true;
      resolve(yes === true);
      // React cannot unmount a root from inside one of its own event
      // handlers, so tidy up on the next tick.
      setTimeout(() => {
        root.unmount();
        host.remove();
      }, 0);
    };
    root.render(<AiConsentDialog disclosure={disclosure} onAnswer={onAnswer} />);
  });
}
