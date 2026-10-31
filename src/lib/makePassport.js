import { Gecko } from '@/entities/all';
import { captureEvent } from '@/lib/posthog';
import { generatePassportCode } from '@/lib/passportUtils';

/**
 * Give a gecko a passport: a code for its public page and QR card.
 *
 * A passport link only works while the gecko is public, so this also
 * turns Public display on, and the record's toast says so. Only the
 * member's own "Make a passport" on the gecko record calls this. The step
 * after "Archive as sold" never does: it sends the transfer only, so a
 * sale never makes a gecko public.
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
