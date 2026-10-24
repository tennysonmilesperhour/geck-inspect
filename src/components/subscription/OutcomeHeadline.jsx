import { useEffect, useRef, useState } from 'react';
import { readOutcomeVariant, recordOutcomeExposure, outcomePromise } from '@/lib/outcomePromise';

/**
 * Which promised outcome this visitor sees (src/lib/outcomePromise.js).
 * `ready` stays false until the flag answers or times out, so every arm
 * waits the same way and nobody sees one headline swap for another.
 * Members already on a paid plan are left out: the page is not selling
 * to them. `pending` holds the headline while the page still works out
 * who the visitor is.
 */
export function useOutcomeVariant({ enabled = true, pending = false } = {}) {
  const [state, setState] = useState(() => ({ ready: !enabled && !pending, variant: null }));
  useEffect(() => {
    if (pending) { setState({ ready: false, variant: null }); return undefined; }
    if (!enabled) { setState({ ready: true, variant: null }); return undefined; }
    let cancelled = false;
    readOutcomeVariant().then((variant) => {
      if (!cancelled) setState({ ready: true, variant });
    });
    return () => { cancelled = true; };
  }, [enabled, pending]);
  return state;
}

/**
 * The headline block. Control (or no arm) renders the page's own heading
 * and lead; a test arm renders the promise in their place. The exposure is
 * recorded after the chosen headline commits.
 */
export default function OutcomeHeadline({
  surface,
  enabled = true,
  pending = false,
  controlHeading,
  controlLead,
  headingClassName,
  leadClassName,
}) {
  const { ready, variant } = useOutcomeVariant({ enabled, pending });
  const recorded = useRef(false);
  useEffect(() => {
    if (!ready || !variant || recorded.current) return;
    recorded.current = true;
    recordOutcomeExposure(variant, surface);
  }, [ready, variant, surface]);

  if (!ready) {
    // Holds the space while the flag answers, so the plans below do not jump.
    return (
      <div aria-busy="true" className="min-h-[5.5rem]">
        <span className="sr-only">Loading</span>
      </div>
    );
  }
  const promise = outcomePromise(variant);
  return (
    <>
      <h1 className={headingClassName}>{promise ? promise.heading : controlHeading}</h1>
      {(promise?.lead || controlLead) && (
        <p className={leadClassName}>{promise ? promise.lead : controlLead}</p>
      )}
    </>
  );
}
