/**
 * The tabs of the Breeding page.
 *
 * The Pairing Planner (/PairingPlanner) and the Season Timeline
 * (/BreedingSeason) used to be pages of their own, each opened by one
 * member a month. They are now the "Pairing ideas" and "Season" tabs
 * (experience review, finding H5), and their old addresses forward here.
 * The page, the two forwards and the tests all read this one list.
 *
 * The ids are what ?tab= carries. 'active', 'hatchery', 'genetics' and
 * 'archive' are linked from Today, the dashboard and the guided demo, so
 * they must keep working: the first tab is labelled "Plans" but keeps the
 * id 'active'.
 */
export const BREEDING_TABS = [
  { id: 'active', label: 'Plans' },
  { id: 'hatchery', label: 'Hatchery' },
  { id: 'pairing-ideas', label: 'Pairing ideas' },
  { id: 'season', label: 'Season' },
  { id: 'genetics', label: 'Genetics' },
  { id: 'archive', label: 'Archive' },
];

export const BREEDING_TAB_LABELS = Object.fromEntries(BREEDING_TABS.map((tab) => [tab.id, tab.label]));

// The first tab reads "Plans", so ?tab=plans should open it too.
const ALIASES = { plans: 'active' };

/** The tab id a ?tab= value names, or null when it names none. */
export function resolveBreedingTab(value) {
  if (!value) return null;
  const wanted = String(value).toLowerCase();
  const id = ALIASES[wanted] || wanted;
  return BREEDING_TAB_LABELS[id] ? id : null;
}

/**
 * The Breeding address for a tab, keeping whatever query and hash the
 * old address carried (campaign tags, for example).
 */
export function breedingTabUrl(tab, search = '', hash = '') {
  const params = new URLSearchParams(search);
  params.set('tab', tab);
  return `/Breeding?${params.toString()}${hash || ''}`;
}
