import { Gecko } from '@/entities/all';
import { captureEvent } from '@/lib/posthog';
import { generatePassportCode } from '@/lib/passportUtils';

/**
 * What a passport is and what making one changes, in the words every
 * place that offers one uses (the record's Share menu and the sold sheet).
 */
export const passportPublicNote = (name) =>
  `A public page and QR card with its lineage and weigh-ins. This makes ${name}'s record public so the link works.`;

/**
 * Give a gecko a passport: a code for its public page and QR card.
 *
 * A passport link only works while the gecko is public, so this also
 * turns Public display on, and the record's toast says so. Two places
 * call it, each when the member chooses: "Make a passport" on the gecko
 * record, and the sold sheet's passport step (OFFER_PASSPORT_AT_SALE in
 * SellHandoverSheet.jsx), which says what it makes public and can be
 * skipped. Sending a transfer never does. Neither the sale price nor the
 * owner's email is on the public row (src/lib/geckoSalePrices.js,
 * src/lib/ownerRows.js).
 *
 * surface says where it was made, for the passport and transfer funnel
 * ('record', Make a passport on the gecko record; 'sold_sheet', the sold
 * sheet's step).
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
