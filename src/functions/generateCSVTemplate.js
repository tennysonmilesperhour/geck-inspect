/**
 * Client-side CSV template generator (replaces dead Base44 backend function).
 *
 * generateCSVTemplate({ includeExisting })
 *   - includeExisting = false → returns an empty template with all column headers
 *   - includeExisting = true  → fetches the user's gecko collection and exports it
 */
import { Gecko } from '@/entities/all';
import { TEMPLATE_FIELDS } from '@/components/my-geckos/csv/columnMapper';

function escapeCSV(value) {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export async function generateCSVTemplate({ includeExisting = false } = {}) {
  const headers = TEMPLATE_FIELDS.map(f => f.key);

  if (!includeExisting) {
    // Empty template — just the header row
    const csv = headers.map(escapeCSV).join(',');
    return { data: csv };
  }

  // Export current collection
  const geckos = await Gecko.filter({ archived: { $ne: true } });

  // Build a lookup of gecko ID → gecko for sire/dam name resolution
  const idMap = new Map();
  for (const g of geckos) {
    if (g.id) idMap.set(g.id, g);
  }

  const rows = geckos.map(g => {
    const sire = g.sire_id ? idMap.get(g.sire_id) : null;
    const dam = g.dam_id ? idMap.get(g.dam_id) : null;

    const row = {
      name:            g.name || '',
      gecko_id_code:   g.gecko_id_code || '',
      sex:             g.sex || '',
      species:         g.species || '',
      hatch_date:      g.hatch_date || '',
      status:          g.status || '',
      morphs_traits:   g.morphs_traits || '',
      morph_tags:      Array.isArray(g.morph_tags) ? g.morph_tags.join(', ') : (g.morph_tags || ''),
      sire_id_code:    sire?.gecko_id_code || '',
      sire_name:       g.sire_name || sire?.name || '',
      dam_id_code:     dam?.gecko_id_code || '',
      dam_name:        g.dam_name || dam?.name || '',
      weight_grams:    g.weight_grams != null ? String(g.weight_grams) : '',
      asking_price:    g.asking_price != null ? String(g.asking_price) : '',
      notes:           g.notes || '',
      breeder_name:    g.breeder_name || '',
      genetics_notes:  g.genetics_notes || '',
      estimated_hatch_year: g.estimated_hatch_year != null ? String(g.estimated_hatch_year) : '',
    };
    return headers.map(h => escapeCSV(row[h])).join(',');
  });

  // BOM for Excel UTF-8 detection
  const csv = '\uFEFF' + [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
  return { data: csv };
}
