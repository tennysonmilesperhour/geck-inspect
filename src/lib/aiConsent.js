// Ask before each AI request; declining never reaches a provider or consumes a credit.
//
// Three ways to ask, with the same promise (Privacy Policy, Third-Party
// Services): name what is sent and to whom, send nothing without a yes,
// and never keep the yes as a lasting preference.
//
// - requireAiConsentInApp(feature) asks in the app's own dialog
//   (src/lib/aiConsentDialog.jsx, loaded only when it is needed). The
//   health screen, visual search, the text request and AI Image Import
//   use it. If the dialog cannot be loaded, the confirm box asks.
// - requireAiConsent(feature) asks with the browser's confirm box. Only
//   the retired Promote feature still asks this way.
// - Morph ID asks on the page instead (src/components/morph-id/
//   AiConsentPanel.jsx), because the iPhone app's web view does not
//   reliably show a confirm box. The member's yes there becomes a grant
//   from grantAiConsent(feature, scope), and the request carries it. A
//   grant covers one feature and one request (its scope, for Morph ID the
//   request key of one set of photos), lives only in the page's memory,
//   and only grants made here count, so a hand-made object never passes.
const DISCLOSURES = {
  'recognize-gecko-morph': 'Send these gecko photos and the life-stage and color-state details to Anthropic for morph identification, and to Replicate for visual comparison when enabled?',
  'health-screen': 'Send this gecko photo, name, hatch date, weight and morph details to Anthropic for an AI health screen?',
  'invoke-llm': 'Send the text for this AI request, including any conversation history and gecko or business records included in it, to Anthropic to generate a response?',
  'generate-social-post': 'Send the selected gecko photos, notes, breeding records, business profile and draft text to Anthropic to generate social posts?',
  'recognize-import-data': 'Send these uploaded images, including any text and personal information visible in them, to Anthropic to extract records?',
  'embed-gecko-image': 'Send this gecko photo to Replicate to find visually similar geckos?',
};

const grants = new WeakSet();

function declined() {
  const error = new Error('AI request canceled. Nothing was sent to the AI providers.');
  error.code = 'ai_consent_declined';
  error.user_message = error.message;
  return error;
}

function confirmInBrowser(disclosure) {
  return typeof window !== 'undefined' && typeof window.confirm === 'function'
    && window.confirm(`${disclosure}\n\nOnly continue with photos and information you have permission to share. See Privacy Policy > Third-Party Services for details. Cancel keeps this request from being sent to AI providers.`);
}

/** The member said yes on the page: a grant for this feature and this one request. */
export function grantAiConsent(feature, scope) {
  if (!DISCLOSURES[feature]) throw new Error('Unknown AI data-sharing request.');
  if (typeof scope !== 'string' || !scope) throw new Error('An AI permission must name the request it covers.');
  const grant = Object.freeze({ feature, scope });
  grants.add(grant);
  return grant;
}

/** True only for a grant made by grantAiConsent for this feature and request. */
export function hasAiConsent(grant, feature, scope) {
  return Boolean(grant) && typeof grant === 'object' && grants.has(grant)
    && grant.feature === feature && typeof scope === 'string' && grant.scope === scope;
}

/**
 * Throws an ai_consent_declined error unless the member said yes.
 * With options.grant (the in-page yes), the grant must match the feature
 * and options.scope; a missing or wrong grant fails closed and never
 * falls back to the confirm box. Without it, the confirm box asks.
 */
export function requireAiConsent(feature, options) {
  const disclosure = DISCLOSURES[feature];
  if (!disclosure) throw new Error('Unknown AI data-sharing request.');
  if (options && Object.prototype.hasOwnProperty.call(options, 'grant')) {
    if (hasAiConsent(options.grant, feature, options.scope)) return;
    throw declined();
  }
  if (!confirmInBrowser(disclosure)) throw declined();
}

/**
 * The same rules as requireAiConsent, asked in the app's own dialog:
 * an unknown feature throws, a grant in options must match or it fails
 * closed without asking, a no throws ai_consent_declined, and a yes is
 * never kept. Resolves only when the member said yes.
 *
 * The dialog is loaded here, on demand. If it cannot be loaded or shown
 * (offline with the file not cached, say), the browser's confirm box
 * asks instead, so the answer is still the member's own.
 */
export async function requireAiConsentInApp(feature, options) {
  const disclosure = DISCLOSURES[feature];
  if (!disclosure) throw new Error('Unknown AI data-sharing request.');
  if (options && Object.prototype.hasOwnProperty.call(options, 'grant')) {
    if (hasAiConsent(options.grant, feature, options.scope)) return;
    throw declined();
  }
  let approved;
  try {
    const { askAiConsent } = await import('@/lib/aiConsentDialog');
    approved = (await askAiConsent(disclosure)) === true;
  } catch {
    approved = confirmInBrowser(disclosure);
  }
  if (!approved) throw declined();
}
