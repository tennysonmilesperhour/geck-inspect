// Mock sponsor data for development and demo purposes.
// Pass a matching entry as the `sponsor` prop on <AdSlot> to preview
// how a direct sponsor card looks without enabling real ads.
//
// Usage example:
//   import { getMockSponsor } from '../data/mockSponsors'
//   <AdSlot placement="sidebar_top" sponsor={getMockSponsor('sidebar_top')} />

export const mockSponsors = [
  {
    name: 'Wasatch Mushroom Society',
    tagline: 'Monthly forays across Utah',
    url: 'https://example.com',
    placement: 'sidebar_top',
    imageUrl: null,
  },
]

/** Returns the mock sponsor for a given placement, or undefined. */
export function getMockSponsor(placement) {
  return mockSponsors.find(s => s.placement === placement)
}
