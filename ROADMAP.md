# ROADMAP.md - Geck Inspect

Last updated: May 2026
Source: Landscape analysis recommendations (full doc in /docs/landscape-analysis-vol1.docx and /docs/landscape-analysis-vol2.docx)

This is the active priority list. Items are formatted so Claude Code can act on them. Each item has a definition of done. Check items off when they ship.

---

## URGENT (next 30 days, before May 31, 2026)

### [ ] 1. Audit geckinspect.com for crested-gecko specificity
**Why:** Breed Ledger launches May 15 as multi-species. Geck Inspect's only defensible moat is being unmistakably crested-gecko-first.
**What changes:**
- Home page hero must mention crested geckos in the first sentence
- All screenshots must show crested gecko interfaces, not generic reptile examples
- All example morphs must be crested gecko specific (Lilly White, Harlequin, Phantom, Cappuccino, Axanthic, Sable, Highway, Dalmatian, Tricolor)
- Brand language must say "crested gecko platform" or "for crested gecko people" - not "reptile" or "lizard"
- Testimonials, if any, should be from named crested gecko breeders or keepers

**Definition of done:** A first-time visitor can tell within 5 seconds that this is specifically for crested geckos, not for reptiles in general.

### [ ] 2. Confirm and document current pricing
**Why:** Market has clustered at specific price points. Need to know if Geck Inspect is aligned, justified, or leaving money on the table.

**Reference pricing:**
- ReptiDex: Free / $4.99 / $9.99 monthly
- HerpTracker: Free / $4.99 monthly
- The Reptile Keeper: Free (5 animals) / £7.99 (~$10) monthly
- HatchLedger: Free (20) / $19 / $49 / $99 monthly
- Cltch: Free trial / Premium / Breeder tiers
- MorphMarket: $5-$30+ for advertising plans

**Definition of done:** Current Geck Inspect pricing is documented in DECISIONS.md with reasoning for each tier. If a change is warranted, it is scheduled.

### [ ] 3. Set up SEO baseline tracking
**Why:** Dusty's blog is actively ranking for category-defining searches. Need to know what's working and what isn't on the Geck Inspect side.

**What to do:**
- Set up Google Search Console for geckinspect.com (if not already)
- Identify 20-30 priority search terms (examples: "crested gecko app", "crested gecko breeding software", "crested gecko genetics calculator", "crested gecko morph identifier", "Lilly White genetics", "Cappuccino crested gecko", "crested gecko care guide app")
- Track ranking weekly
- Document baseline in /docs/seo-baseline-may-2026.md

**Definition of done:** Search Console is configured, baseline rankings are documented, and weekly tracking is automated or scheduled.

### [ ] 4. Publish a comparison article
**Why:** Dusty's blog ranks for "best kennel management software 2026" with his own products framed favorably. Geck Inspect needs a counter-piece from the crested-gecko-specific angle.

**Topic:** "Crested Gecko Software in 2026: An Honest Comparison" (or similar)

**Coverage:**
- Geck Inspect, Geckistry, ReptiDex, Breed Ledger, MorphMarket, The Reptile Keeper, HatchLedger
- Honest about each platform's strengths and weaknesses
- Lead with crested-gecko-specific concerns, not generic reptile-software concerns
- Include pricing, mobile availability, AI features, registry partnerships

**Definition of done:** Article is published on geckinspect.com/blog (or equivalent), shared on r/cresties, MorphMarket Reptile Community, Pangea forums, and relevant Facebook groups.

### [ ] 5. Outreach to GSGC and high-profile breeders
**Why:** Dusty's biggest credibility gap is one year of crested gecko breeding experience. The strongest counter is endorsements from established breeders.

**Targets (in priority order):**
- ACR / Anthony Caponetto (20+ years)
- Fringemorphs (15+ years, premium focus)
- Altitude Exotics (axanthic specialty, large following)
- BB's Crested Geckos (5.0/5 MorphMarket reputation)
- Lilly Exotics (10+ years)
- GSGC committee (relationship-only since they are on Breed Ledger)

**What to offer:**
- Free Pro/Premium accounts
- Co-branded content opportunities
- Sponsorship of their content
- Direct input on roadmap

**Definition of done:** Outreach sent to all six. At least one positive conversation initiated with a long-tenured breeder.

### [ ] 6. Book NRBE Daytona attendance
**Why:** August 15-16, 2026. The most important crested gecko event of the year. 100,000 sq ft. GSGC competitions held here. Skipping this means absence from the conversation that sets the breeding-season tone.

**Decision required:**
- Tier 1 (essential): Attend as a buyer. ~$1,000-$1,500 cost.
- Tier 2 (recommended): Sponsor a category or talk. ~$1,500-$5,000.
- Tier 3 (ambitious): Vend a booth. ~$3,000-$8,000 plus 2-3 weeks prep.

**Recommendation:** At minimum Tier 1. Tier 2 (sponsoring the GSGC competition category for $2-5K) is the highest-leverage spend in this entire roadmap.

**Definition of done:** Travel and accommodations booked. Sponsorship decision made and committed.

---

## STRATEGIC (next 90 days, by August 2026)

### [ ] 7. Ship native iOS or polished PWA
**Why:** Single biggest functional gap. Every serious competitor has mobile. Geck Inspect is the only major platform that does not.

**Two paths:**
- **Path A - Native iOS:** React Native or Expo. Stack-compatible (JavaScript + Supabase). 3-6 months solo or with contractor. Full parity with ReptiDex and Cltch.
- **Path B - PWA:** Service worker for offline, web app manifest for install-to-home-screen, push notifications. 3-6 weeks. 80% of native experience.

**Recommendation:** Ship the PWA in 30-45 days. Begin native iOS in parallel for the next 6 months.

**Definition of done:** Geckinspect.com installs to iOS and Android home screens, works offline for collection management, sends push notifications for breeding/feeding/shed reminders.

### [ ] 8. Pick and ship one moat feature
**Why:** Need a feature nobody else can replicate in 6 months.

**Candidates (ranked by ROI):**

**Option A: Conformation/structure AI grading (highest defensibility)**
- Partner with respected breeders or GSGC judges to label structure photos
- Train a model on body proportions, head shape, crest size
- Ship as beta to gather more training data
- Risk: requires consistent labeling. Subjective.
- Defensibility: very high. Dataset is hard to replicate.

**Option B: IoT/sensor integration (easy win)**
- Integrate Govee, SwitchBot, SmartThings APIs
- Show environmental data on each animal record
- Alert on humidity/temperature anomalies
- Risk: low.
- Defensibility: medium. Others could copy in 6 months.

**Option C: Provenance/authenticity certificates (medium effort)**
- Signed PDF certificates with embedded QR codes
- Cryptographic verification
- No blockchain needed
- Risk: low technically. Adoption is the question.
- Defensibility: low until network effects kick in.

**Recommendation:** Option A if able to source labeled data. Option B as fallback.

**Definition of done:** One option is shipped in beta and announced publicly.

### [ ] 9. Open the keeper market product
**Why:** Doubles TAM. Generates AI training data. Top of funnel for breeder upgrades.

**What to build:**
- Care reminders (mist, weigh, restock food)
- Growth tracking with simple visualizations
- Vet records and reminders
- Simple morph ID (use existing AI)
- Shareable gecko profile pages
- Q&A/community access

**Pricing:** $3-5/month, generous free tier (1-2 geckos free forever).

**Definition of done:** Geckinspect.com Keeper (or branded equivalent) is live with at least 100 active users.

### [ ] 10. Build MorphMarket export integration
**Why:** Most breeders use MorphMarket as their primary sales channel. One-click export reduces friction. Cltch already does this for ball pythons.

**What to build:**
- "Export to MorphMarket" button on each animal record
- Auto-fill listing title, photos, morphs, pedigree summary
- Track sync status

**Definition of done:** A breeder can list a gecko on MorphMarket from inside Geck Inspect in under 60 seconds.

### [ ] 11. Set up content infrastructure
**Why:** Long-form SEO content is the proven distribution channel. HatchLedger, Built By Dusty, Tenny's Crested Geckos all use this.

**What to build:**
- Blog at geckinspect.com/blog (if not already)
- Sitemap, schema markup, internal linking
- Editorial calendar: 1-2 long-form articles per month minimum

**High-priority topics (commercial intent):**
- "Geck Inspect vs ReptiDex" (and other comparisons)
- "Best Crested Gecko Apps 2026"
- "Complete Guide to Lilly White Genetics"
- "Setting Up Your First Crested Gecko Breeding Season"
- "Crested Gecko Prices in 2026" (leveraging Tenny's data)
- "Phantom in Crested Geckos: What We Know and Don't Know"

**Definition of done:** Blog infrastructure is live. First 3 articles published. Editorial calendar is documented for the next 6 months.

### [ ] 12. Add AI shed prediction
**Why:** The Reptile Keeper has "Shed Forecast" as a flagship AI differentiator. Adding shed prediction to Geck Inspect's AI feature set creates a second AI moment in the product.

**What to build:**
- Take weight changes, last shed date, ambient temp/humidity (if available via IoT integration)
- Predict next shed window
- Push notification when shed is likely

**Definition of done:** Shed prediction works for at least 80% of test cases on a labeled dataset.

---

## POSITIONING (next 12 months)

### [ ] 13. Become institutional
**Why:** GSGC is locked up. The boldest move is to start a competing or complementary institution.

**Options:**
- "Geck Inspect Verified" - published standard for breeders. Health guarantees, transparency requirements, accurate morph labeling, ethical practices. Verified breeders get a badge and directory listing.
- New conformation competition focused on color/pattern (different criteria than GSGC's structure focus).
- Regional/international expansion - UK/EU/AU GSGC equivalents that run on Geck Inspect.

**Definition of done:** Either a Geck Inspect Verified program is live with 10+ verified breeders, or a partnership with USARK/REPTA/regional reptile group is publicly announced.

### [ ] 14. Genetic testing partnership
**Why:** Cltch has RGI for ball pythons. No equivalent for crested geckos exists. First mover wins the category.

**What to do:**
- Identify potential lab partners
- Validate which crested gecko traits are genetically testable today
- Establish referral or integration deal

**Definition of done:** At least one genetic testing service is integrated with Geck Inspect for crested gecko trait confirmation.

### [ ] 15. International expansion
**Why:** UK, EU, Canada, Australia are roughly equal in scale to the US for crested geckos. The Reptile Keeper already understands this. ReptiDex is US-only currently.

**What to build:**
- Multi-currency pricing (USD, GBP, EUR, CAD, AUD)
- Region-specific care guides (UVB recommendations vary by region)
- Localized content where it matters most

**Definition of done:** Geck Inspect supports multi-currency checkout and has region-aware content for at least US, UK, EU.

### [ ] 16. Mobile portfolio complete
**Why:** By 12 months out, expectation is full mobile parity.

**What to ship:**
- Native iOS app (App Store)
- Native Android app (Play Store) or polished PWA fallback
- Feature parity between web, iOS, Android

**Definition of done:** Both apps are live in their respective stores with 1.0 release notes published.

---

## DEFENSIVE (do anytime, low effort)

### [ ] 17. Trademark and domain protection
- File USPTO trademark for "Geck Inspect" (if not already filed)
- Register defensive domains: geckinspect.app, geckinspect.io, geck.app, geckinspect.co
- Register social handles across Instagram, TikTok, YouTube, Reddit, Threads, Bluesky

**Definition of done:** Trademark filed. Defensive domains registered. Social handles claimed.

### [ ] 18. Data export and ownership messaging
**Why:** ReptiDex makes a point of "your records belong to you." Cltch promises full export. Lock-in fears are real.

**What to do:**
- Ensure full data export to CSV/JSON works for every user-created record
- Prominently advertise this on the home page and pricing page
- Add "Export your data" to settings

**Definition of done:** Export works. Messaging is on home page. Tested with a real account.

---

## How to use this file

When working with Claude Code:
- "Let's tackle item 1" or "let's audit the home page for crested gecko specificity" - Claude Code reads the item, knows the why and the definition of done
- "What's next on the roadmap?" - Claude Code lists open items by priority tier
- "Mark item 1 as done" - update the checkbox

Update this file when:
- An item ships (check the box, add date, note key learnings)
- Priorities shift based on competitor moves or user feedback
- New items are added (keep them in the right priority tier)

The numbered IDs are stable. Don't renumber when items complete - just check them off so the conversation history stays coherent.
