import { Gecko } from '@/entities/all';
import { captureEvent } from '@/lib/posthog';
import { generatePassportCode } from '@/lib/passportUtils';

/**
 * What a passport is and what making one changes, in the words every
 * place that offers one uses (today the record's Share menu).
 */
export const passportPublicNote = (name) =>
  `A public page and QR card with its lineage and weigh-ins. This makes ${name}'s record public so the link works.`;

/**
 * Give a gecko a passport: a code for its public page and QR card.
 *
 * A passport link only works while the gecko is public, so this also
 * turns Public display on, and the record's toast says so. Only the
 * member's own "Make a passport" on the gecko record calls this. Marking
 * a gecko sold and sending a transfer never do. The sold sheet has a
 * passport step written but switched off (OFFER_PASSPORT_AT_SALE in
 * SellHandoverSheet.jsx says why, and what would switch it on). The sale
 * price is not on the public row any more (src/lib/geckoSalePrices.js).
 *
 * surface says where it was made, for the passport and transfer funnel
 * ('record', Make a passport on the gecko record).
 *
 * Throws when the save fails. Returns the fields it changed.
 */
export async function makePassport(gecko, { surface = 'record' } = {}) {
  const fields = { passport_code: generatePassportCode(), is_public: true };
  await Gecko.update(gecko.id, fields);
  // No code, name or owner in the event: where it was made, and whether
  // the gecko was already public before (null when the row did not say).
  const wasPublic = typeof gecko.is_public === 'boolean' ? gecko.is_public : null;
  captureEvent('passport_created', { surface, was_public: wasPublic });
  return fields;
}
