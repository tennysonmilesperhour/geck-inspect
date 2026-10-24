# Signed-in homepage, 17 October 2026

Implemented after the October 16 update. Dashboard keeps the app's existing theme, navigation destinations and all enabled dashboard modules. Care appears first beside Community Pulse, followed by collection statistics, value summaries, recent animal records, community panels and breeding tools. Customize home updates the existing device preferences. Retired features stay retired.

The menu's only changes are unread-event counts and accessible descriptions. In a collapsed desktop sidebar, the count disappears and the icon pulses gold. Reduced motion uses a steady glow. Counts reuse the notification bell's current unread rows and clear through its existing read/dismiss behavior. Child routes roll up to their current menu destination; care-log reminders belong to Today. No new polling or notification records.

Collection estimated value and season projected value on Dashboard require a paid entitlement through resolveTier, including the existing admin and complimentary access rules. Free members see one compact upgrade link. Their existing Portfolio and individual-animal estimates remain available. No billing or database permissions changed.

The collection card shares Portfolio's valuation function and its accessible-collection rules. It excludes archived animals and reports valuation coverage; it links to Portfolio for provenance, individual values and history. Opening Dashboard does not write a historical snapshot.

Season value uses eggs laid in the current calendar year:

    (already hatched + (incubating + additional planned eggs) * expected hatch rate) * average hatchling value

Hatched archives still count; archived incubating eggs do not. Default hatch rate comes from the existing season projection model. The starting average is the low end of the least expensive well-sampled Geck Data hatchling trait; members can replace it. Additional planned eggs start at zero. Assumptions save on this device per account and season. Copy explains gross value before costs, uncertain sales, and overlap with collection value.

The new browser checks cover free/paid access, saved assumptions, downgrade, care ordering, menu indicators and reduced motion on desktop and phone. They run alongside the existing sign-up, first-gecko, feeding and transfer flow. Fixtures do not access production data or charge accounts.

Photo detail opens on demand through the existing lazy import retry helper. To stay within the shared download budget, the Morph Guide name-normalization helper now lives in morphUtils instead of pulling its photo-loading module into each detail page. Optional hero-photo loading retains its existing failure fallback.
