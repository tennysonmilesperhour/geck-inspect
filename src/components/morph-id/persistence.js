import { GeckoImage } from '@/entities/all';
import { TAXONOMY_VERSION } from './morphTaxonomy';

// `training_meta` and `image_urls` are columns the dataset is migrating
// toward. Until every deployed copy of the schema has them, we fall back
// to folding `training_meta` into the notes field and dropping
// `image_urls` onto `training_meta` — nothing is ever dropped.
export async function saveGeckoImageWithMeta(record) {
  const attempts = [
    (r) => r,
    // No image_urls column: move it into training_meta.
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
