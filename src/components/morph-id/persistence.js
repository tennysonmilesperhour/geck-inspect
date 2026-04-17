import { GeckoImage } from '@/entities/all';
import { TAXONOMY_VERSION } from './morphTaxonomy';

// `training_meta` is a JSONB column the dataset is migrating toward. Until
// the migration is universal we fall back to folding the payload into `notes`
// when the column is missing — nothing is ever dropped.
export async function saveGeckoImageWithMeta(record) {
  try {
    return await GeckoImage.create(record);
  } catch (err) {
    if (!/training_meta/i.test(err.message || '')) throw err;
    const { training_meta: meta, ...rest } = record;
    return GeckoImage.create({
      ...rest,
      notes: [
        rest.notes,
        `\n--- training metadata (${TAXONOMY_VERSION}) ---\n${JSON.stringify(meta, null, 2)}`,
      ].filter(Boolean).join(''),
    });
  }
}
