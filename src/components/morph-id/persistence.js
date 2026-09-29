import { GeckoImage } from '@/entities/all';
import { TAXONOMY_VERSION } from './morphTaxonomy';

// gecko_images has training_meta but no image_urls column (checked 29 Sep
// 2026), so image_urls always rides inside training_meta. Sending it as a
// column first made every Morph ID save fail once with a 400 before the
// retry. If training_meta is ever missing, everything folds into notes;
// nothing is dropped.
export async function saveGeckoImageWithMeta(record) {
  const attempts = [
    // Move image_urls into training_meta.
    (r) => {
      const { image_urls, ...rest } = r;
      return image_urls
        ? { ...rest, training_meta: { ...(rest.training_meta || {}), image_urls } }
        : r;
    },
    // No training_meta column: fold everything into notes.
    (r) => {
      const { training_meta, ...rest } = r;
      if (!training_meta) return r;
      return {
        ...rest,
        notes: [
          rest.notes,
          `\n--- training metadata (${TAXONOMY_VERSION}) ---\n${JSON.stringify(training_meta, null, 2)}`,
        ].filter(Boolean).join(''),
      };
    },
  ];

  let lastErr;
  let current = record;
  for (const transform of attempts) {
    current = transform(current);
    try {
      return await GeckoImage.create(current);
    } catch (err) {
      lastErr = err;
      const msg = err?.message || '';
      // Keep trying only for schema-drift errors.
      if (!/column|schema|does not exist/i.test(msg)) throw err;
    }
  }
  throw lastErr;
}
