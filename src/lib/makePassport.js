import { Gecko } from '@/entities/all';
import { captureEvent } from '@/lib/posthog';
import { generatePassportCode } from '@/lib/passportUtils';

/**
 * Give a gecko a passport: a code for its public page and QR card.
 *
 * A passport link only works while the gecko is public, so this also
 * turns Public display on. Every place that makes a passport says so to
 * the member first (the record's toast, the step after "Archive as sold").
 *
 * surface says where it was made, for the passport and transfer funnel:
 * 'record' (Make a passport on the gecko record) or 'sold_step' (sending
 * the transfer right after archiving the gecko as sold).
 *
 * Throws when the save fails. Returns the fields it changed.
 */
export async function makePassport(gecko, { surface = 'record' } = {}) {
  const fields = { passport_code: generatePassportCode(), is_public: true };
  await Gecko.update(gecko.id, fields);
  // No code, name or owner in the event: where it was made, and whether
  // the gecko was already public before.
  captureEvent('passport_created', { surface, was_public: gecko.is_public ?? true });
  return fields;
}
