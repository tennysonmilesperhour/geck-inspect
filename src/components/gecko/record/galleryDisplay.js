import { Gecko, GeckoImage } from '@/entities/all';
import { PRIMARY_MORPHS } from '@/components/morph-id/morphTaxonomy';

// The species ("Crested Gecko") is NOT a morph, and genetic traits
// (Lilly White, Axanthic, ...) are not primary morphs. When syncing a
// gecko's photos into the gecko_images training corpus, only fill
// primary_morph when a tag actually maps to a canonical primary-morph
// PATTERN id. Anything else stays null instead of polluting the corpus
// with species/trait labels the AI Morph ID model can't return.
const PRIMARY_MORPH_ID_BY_LABEL = new Map(PRIMARY_MORPHS.map((m) => [m.label.toLowerCase(), m.id]));

export function resolvePrimaryMorphId(gecko) {
  const candidates = [
    ...(Array.isArray(gecko?.morph_tags) ? gecko.morph_tags : []),
    ...String(gecko?.morphs_traits || '').split(','),
  ];
  for (const candidate of candidates) {
    const id = PRIMARY_MORPH_ID_BY_LABEL.get(String(candidate).trim().toLowerCase());
    if (id) return id;
  }
  return null;
}

/**
 * Turn "Gallery display" on or off for one gecko. The public Gallery reads
 * gecko_images, not the geckos table, so the flag alone did nothing: this
 * also adds the gecko's photos there (skipping ones already in it), or
 * removes the ones that came from this gecko. Returns how many photos the
 * gecko has, for the confirmation message.
 */
export async function setGalleryDisplay(gecko, checked) {
  await Gecko.update(gecko.id, { gallery_display: checked });
  const imageUrls = Array.isArray(gecko.image_urls) ? gecko.image_urls.filter(Boolean) : [];
  if (imageUrls.length === 0) return 0;
  const existing = await GeckoImage.filter({ created_by: gecko.created_by }).catch(() => []);
  if (checked) {
    const existingUrls = new Set(existing.map((row) => row.image_url).filter(Boolean));
    for (const url of imageUrls) {
      if (existingUrls.has(url)) continue;
      try {
        await GeckoImage.create({
          image_url: url,
          primary_morph: resolvePrimaryMorphId(gecko),
          secondary_traits: Array.isArray(gecko.morph_tags) ? gecko.morph_tags : [],
          notes: `Gallery entry for ${gecko.name}`,
          verified: false,
        });
      } catch (imgErr) {
        console.warn('Failed to create GeckoImage:', imgErr);
      }
    }
  } else {
    const urlSet = new Set(imageUrls);
    for (const row of existing) {
      if (!urlSet.has(row.image_url)) continue;
      try {
        await GeckoImage.delete(row.id);
      } catch (delErr) {
        console.warn('Failed to remove GeckoImage:', delErr);
      }
    }
  }
  return imageUrls.length;
}
