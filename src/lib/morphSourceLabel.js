/**
 * Link text for the sources listed under a Morph Guide entry. Each link
 * is named after the site it points to. Until 16 Oct 2026 every source
 * that was not Pangea, AC Reptiles or Corch was labelled LIL MONSTERS, so
 * a MorphMarket or ReptiDex page (the Super Highway health reports among
 * them) read as a claim LM Reptiles had made.
 */

// Hostname (without "www.") to the name readers know the site by.
const SOURCE_LABELS = {
  'lmreptiles.com': 'LIL MONSTERS · specimens and breeder model',
  'acreptiles.com': 'AC Reptiles · project observations',
  'pangeareptile.com': 'Pangea Reptile',
  'corchgeckos.com': 'Corch Geckos · Lilly White project',
  'morphmarket.com': 'MorphMarket Morphpedia',
  'reptidex.com': 'ReptiDex',
};

export function sourceHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** The label for one source link: a known site's name, otherwise its hostname. */
export function morphSourceLabel(url) {
  const host = sourceHost(url);
  return SOURCE_LABELS[host] || host || String(url || '');
}

/**
 * Labels for an entry's sources, numbered when one site appears more than
 * once (Phantom cites two LM Reptiles pages), so no two links read alike.
 */
export function morphSourceLinks(urls = []) {
  const totals = {};
  for (const url of urls) {
    const label = morphSourceLabel(url);
    totals[label] = (totals[label] || 0) + 1;
  }
  const seen = {};
  return urls.map((url) => {
    const label = morphSourceLabel(url);
    seen[label] = (seen[label] || 0) + 1;
    return { url, label: totals[label] > 1 ? `${label} (${seen[label]})` : label };
  });
}

export const KNOWN_SOURCE_HOSTS = Object.keys(SOURCE_LABELS);
