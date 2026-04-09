// Ad configuration
// Set VITE_ADS_ENABLED=true in production to activate ad rendering.
// With ADS_ENABLED=false (default), all AdSlot components render null —
// no blank boxes, no layout shift in development.

export const ADS_ENABLED = import.meta.env.VITE_ADS_ENABLED === 'true'

// Your AdSense publisher ID, e.g. "ca-pub-1234567890123456"
export const ADSENSE_CLIENT_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID || ''

// Named placement definitions.
// slotId values come from your AdSense account (Ad units → get code).
// Replace the placeholder strings once you create ad units in AdSense.
export const AD_SLOTS = {
  sidebar_top: {
    slotId: '1111111111',
    size: '300x250',
    label: 'Advertisement',
  },
  sidebar_bottom: {
    slotId: '2222222222',
    size: '300x250',
    label: 'Sponsored',
  },
  map_banner: {
    slotId: '3333333333',
    size: '728x90',
    label: 'Advertisement',
  },
  species_detail: {
    slotId: '4444444444',
    size: '300x250',
    label: 'Sponsored',
  },
}
