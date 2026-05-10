/**
 * useGeckoFilters ,  client-side filtering + sorting for gecko collections.
 *
 * Extracted from MyGeckos.jsx. Pure computation ,  no API calls.
 */
import { useMemo } from 'react';

const STATUS_ORDER = ['Proven', 'Ready to Breed', 'Future Breeder', 'Holdback', 'For Sale', 'Pet', 'Sold'];
const SEX_ORDER = { Male: 0, Female: 1, Unsexed: 2 };
const ARCHIVE_ORDER = { death: 0, sold: 1, other: 2 };

function getLatestWeight(gecko, weightRecords) {
  const records = weightRecords.filter(w => w.gecko_id === gecko.id);
  if (records.length > 0) {
    return [...records].sort((a, b) =>
      new Date(b.record_date) - new Date(a.record_date)
    )[0].weight_grams;
  }
  return gecko.weight_grams ?? null;
}

export function filterGeckos(geckos, filters, weightRecords) {
  let result = [...geckos];

  if (filters.sexes?.length > 0) {
    result = result.filter(g => filters.sexes.includes(g.sex));
  }
  if (filters.statuses?.length > 0) {
    result = result.filter(g => filters.statuses.includes(g.status));
  }
  if (filters.weightMin) {
    const min = parseFloat(filters.weightMin);
    result = result.filter(g => {
      const w = getLatestWeight(g, weightRecords);
      return w !== null && w >= min;
    });
  }
  if (filters.weightMax) {
    const max = parseFloat(filters.weightMax);
    result = result.filter(g => {
      const w = getLatestWeight(g, weightRecords);
      return w !== null && w <= max;
    });
  }
  if (filters.traits?.length > 0) {
    result = result.filter(g => {
      if (!g.morphs_traits) return false;
      const morphsLower = g.morphs_traits.toLowerCase();
      return filters.traits.every(trait => morphsLower.includes(trait.toLowerCase()));
    });
  }
  if (filters.morphTags?.length > 0) {
    result = result.filter(g => {
      if (!g.morph_tags || g.morph_tags.length === 0) return false;
      return filters.morphTags.every(tag => g.morph_tags.includes(tag));
    });
  }
  if (filters.feedingGroupIds?.length > 0) {
    result = result.filter(g => filters.feedingGroupIds.includes(g.feeding_group_id));
  }
  if (filters.species?.length > 0) {
    result = result.filter(g => filters.species.includes(g.species || 'Crested Gecko'));
  }

  return result;
}

export function sortGeckos(geckos, sortBy, weightRecords) {
  const sorted = [...geckos];
  switch (sortBy) {
    case 'name':
      return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    case 'date_added':
      return sorted.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    case 'hatch_date_newest':
      return sorted.sort((a, b) => {
        if (!a.hatch_date && !b.hatch_date) return 0;
        if (!a.hatch_date) return 1;
        if (!b.hatch_date) return -1;
        return new Date(b.hatch_date) - new Date(a.hatch_date);
      });
    case 'hatch_date_oldest':
      return sorted.sort((a, b) => {
        if (!a.hatch_date && !b.hatch_date) return 0;
        if (!a.hatch_date) return 1;
        if (!b.hatch_date) return -1;
        return new Date(a.hatch_date) - new Date(b.hatch_date);
      });
    case 'status':
      return sorted.sort((a, b) => {
        const ai = STATUS_ORDER.indexOf(a.status);
        const bi = STATUS_ORDER.indexOf(b.status);
        if (ai === -1 && bi === -1) return (a.status || '').localeCompare(b.status || '');
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    case 'weight_heaviest':
      return sorted.sort((a, b) => (getLatestWeight(b, weightRecords) || 0) - (getLatestWeight(a, weightRecords) || 0));
    case 'weight_lightest':
      return sorted.sort((a, b) => (getLatestWeight(a, weightRecords) || Infinity) - (getLatestWeight(b, weightRecords) || Infinity));
    case 'sex':
      return sorted.sort((a, b) => (SEX_ORDER[a.sex] ?? 3) - (SEX_ORDER[b.sex] ?? 3));
    case 'archive_reason':
      return sorted.sort((a, b) => (ARCHIVE_ORDER[a.archive_reason] ?? 3) - (ARCHIVE_ORDER[b.archive_reason] ?? 3));
    case 'species':
      return sorted.sort((a, b) => (a.species || 'Crested Gecko').localeCompare(b.species || 'Crested Gecko'));
    default:
      return sorted;
  }
}

export function useGeckoFilters(geckos, weightRecords, { filters, sortBy, searchTerm, showArchived }) {
  return useMemo(() => {
    const base = geckos
      .filter(g => showArchived ? g.archived : (!g.archived && g.status !== 'Sold'))
      .filter(g => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
          (g.name || '').toLowerCase().includes(term) ||
          (g.gecko_id_code || '').toLowerCase().includes(term) ||
          (g.morphs_traits || '').toLowerCase().includes(term) ||
          (g.morph_tags || []).some(tag => tag.toLowerCase().includes(term))
        );
      });

    const filtered = filterGeckos(base, filters, weightRecords);
    return sortGeckos(filtered, sortBy, weightRecords);
  }, [geckos, weightRecords, filters, sortBy, searchTerm, showArchived]);
}
