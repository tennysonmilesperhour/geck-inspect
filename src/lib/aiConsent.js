// Ask before each AI request; declining never reaches a provider or consumes a credit.
const DISCLOSURES = {
  'recognize-gecko-morph': 'Send these gecko photos and the life-stage and color-state details to Anthropic for morph identification, and to Replicate for visual comparison when enabled?',
  'health-screen': 'Send this gecko photo, name, hatch date, weight and morph details to Anthropic for an AI health screen?',
  'invoke-llm': 'Send the text for this AI request, including any conversation history and gecko or business records included in it, to Anthropic to generate a response?',
  'generate-social-post': 'Send the selected gecko photos, notes, breeding records, business profile and draft text to Anthropic to generate social posts?',
  'recognize-import-data': 'Send these uploaded images, including any text and personal information visible in them, to Anthropic to extract records?',
  'embed-gecko-image': 'Send this gecko photo to Replicate to find visually similar geckos?',
};

export function requireAiConsent(feature) {
  const disclosure = DISCLOSURES[feature];
  if (!disclosure) throw new Error('Unknown AI data-sharing request.');
  const approved = typeof window !== 'undefined' && typeof window.confirm === 'function'
    && window.confirm(`${disclosure}\n\nOnly continue with photos and information you have permission to share. See Privacy Policy > Third-Party Services for details. Cancel keeps this request from being sent to AI providers.`);
  if (!approved) {
    const error = new Error('AI request canceled. Nothing was sent to the AI providers.');
    error.code = 'ai_consent_declined';
    error.user_message = error.message;
    throw error;
  }
}
