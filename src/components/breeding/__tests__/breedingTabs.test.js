import { describe, expect, it } from 'vitest';
import { BREEDING_TABS, breedingTabUrl, resolveBreedingTab } from '../breedingTabs';

// The Breeding page's tabs (experience review, finding H5). Today, the
// dashboard and the guided demo link to ?tab=hatchery style addresses, so
// the ids the page had before the planners moved in must keep working.
describe('Breeding tabs', () => {
  it('lists the six tabs in order, by the names the review chose', () => {
    expect(BREEDING_TABS.map((tab) => tab.label)).toEqual([
      'Plans', 'Hatchery', 'Pairing ideas', 'Season', 'Genetics', 'Archive',
    ]);
  });

  it('keeps every tab id that was linked before, and adds the two new ones', () => {
    for (const id of ['active', 'hatchery', 'genetics', 'archive', 'pairing-ideas', 'season']) {
      expect(resolveBreedingTab(id), id).toBe(id);
    }
  });

  it('opens the first tab for ?tab=plans, the name it now shows', () => {
    expect(resolveBreedingTab('plans')).toBe('active');
    expect(resolveBreedingTab('Season')).toBe('season');
  });

  it('answers null for a missing or unknown tab, so the page keeps its default', () => {
    expect(resolveBreedingTab(null)).toBeNull();
    expect(resolveBreedingTab('')).toBeNull();
    expect(resolveBreedingTab('project-manager')).toBeNull();
  });

  it('builds the tab address and keeps the query and hash the old address carried', () => {
    expect(breedingTabUrl('season')).toBe('/Breeding?tab=season');
    expect(breedingTabUrl('pairing-ideas', '?utm_source=weekly-notes')).toBe('/Breeding?utm_source=weekly-notes&tab=pairing-ideas');
    expect(breedingTabUrl('season', '?tab=old', '#top')).toBe('/Breeding?tab=season#top');
  });
});
