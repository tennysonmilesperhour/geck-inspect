// AdSlot — unified component for all ad placements.
//
// Rendering rules:
//   ADS_ENABLED=false  → renders null (clean dev experience, no blank boxes)
//   sponsor prop given → renders a SponsorCard (direct / local sponsor)
//   no sponsor         → renders Google AdSense ins tag
//
// Prerequisites for AdSense to actually serve ads in production:
//   1. Add to index.html <head>:
//      <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js
//              ?client=YOUR_CLIENT_ID" crossOrigin="anonymous"></script>
//   2. Set VITE_ADS_ENABLED=true and VITE_ADSENSE_CLIENT_ID in production env.

import { useEffect, useRef } from 'react'
import { ADS_ENABLED, ADSENSE_CLIENT_ID, AD_SLOTS } from '../config/ads'
import SponsorCard from './SponsorCard'

export default function AdSlot({ placement, sponsor }) {
  const slot = AD_SLOTS[placement]
  const insRef = useRef(null)
  const pushed = useRef(false)

  useEffect(() => {
    if (!ADS_ENABLED || sponsor || !slot || pushed.current) return
    pushed.current = true
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // AdSense script not loaded — silently ignore
    }
  }, [slot, sponsor])

  // Nothing to show
  if (!ADS_ENABLED || !slot) return null

  // Direct sponsor takes priority over AdSense
  if (sponsor) {
    return <SponsorCard sponsor={sponsor} label={slot.label} />
  }

  // Google AdSense ins tag
  return (
    <div>
      <p
        style={{
          fontSize: 10,
          color: '#9ca3af',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 2,
          textAlign: 'right',
        }}
      >
        {slot.label}
      </p>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slot.slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
