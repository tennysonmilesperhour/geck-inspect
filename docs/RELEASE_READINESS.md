# Release evidence, September 6, 2026

The RevenueCat webhook blocker is resolved. This is an evidence record, not a
claim that every device/store flow has passed or that the entire product is
ready for submission without the remaining checks.

## Repaired and verified

| Area | Result |
|---|---|
| RevenueCat delivery | Live authenticated TEST returned HTTP 200; receipt persisted; no access granted by TEST |
| Real catalog mapping | Apple Keeper and Breeder products map to their own tiers; legacy Pro compatibility retained |
| Purchase/restore reconciliation | Deployed signed-in `revenuecat-sync`; caller cannot choose another UUID or forge access; repeated calls return 429 |
| Subscription lifecycle | Tests cover expiration, paid time after cancellation, billing grace, deferred changes, lifetime refunds, transfers, aliases, retries and ordered atomic writes |
| Cross-tool membership | Browser/provider/user facades and metered server tools use verified store access alongside Stripe, preserving higher existing tiers |
| Account changes | Delayed profiles cannot resurrect a signed-out account; old billing extras are rejected; query/layout caches and account views reset on identity change |
| Identity trust | Editable metadata cannot choose account identity, admin role or membership |
| Auth configuration | Canonical web site and exact native confirmation/recovery return URLs saved in Supabase |
| Shared references | Crested image/taxonomy lookups are species-scoped; failed inventory reads show errors; all-species ingestion is labeled accurately |
| Companion market feed | Live Geck Intellect snapshot returned 200 with 10,011 observations and 1,007 breeders at verification; confirmed sales are distinct from asking-price observations |
| Community | Forum comments have contextual reports; blocked authors disappear from forum/Q&A views; server message blocking remains enforced |
| Moderation data safety | Removing a marketplace listing now unpublishes it and preserves the owner's private animal and care records |
| Notifications | Forum replies use the existing server dispatcher instead of dead email stubs and private recipient-profile lookups |
| Shared database performance | Combo-price query restricts observations before weekly deduplication; five equivalence cases passed; benchmark fell from 627 ms to 21 ms and 53,097 to 1,526 shared buffer hits |
| Configuration hygiene | Refreshed invalid production Vercel service key; added iOS public SDK key; secrets kept outside source control |
| Engineering handoff | Current identity/integration guide, focused billing runbook, corrected route-registration comments and removed unused code |

Database timing is one controlled comparison on the same query and privileges,
not a load test or guarantee of infrastructure capacity. Supabase displayed a
resource-pressure warning during the audit; reassess real usage after the hot
query repair before deciding whether compute capacity needs to change.

## Verification scope

The complete web build includes ESLint, Vitest, generated public assets, Vite,
prerender and SEO checks. The final build passed 701 tests across 27 files,
with no lint errors or warnings. Browser checks passed for the demo collection,
guest sign-up, forum and Q&A, with no client console errors. SEO checks covered
165 routes with zero errors, 67 content warnings and one orphan route.

The database rollback scripts passed for animal/weight atomicity, private
visibility, votes/accepted answers, blocked messages, duplicate/out-of-order
billing, tier precedence and service-only reconciliation. Ordinary-user HTTP
checks passed on the live sync endpoint; disposable Supabase records were cleaned
up. Only an empty RevenueCat test customer remains from the lookup.

The iOS simulator compilation passed with the configured Apple SDK key. This
verifies compilation, not Apple payment processing, signed distribution or
physical-device behavior. `pnpm typecheck` remains a limited JavaScript syntax
check, not full static typing. The SEO audit still has content warnings.

## Submission gates still requiring evidence

1. **Authenticated App Store Connect review:** uploaded build/version, agreements,
   subscription availability and group levels, review metadata/privacy answers,
   and Apple server notifications. The dashboard was signed out; a sign-in tab
   was left available. RevenueCat's in-app purchase key is valid, but no Apple
   server notification had been received during this audit.
2. **Actual release-binary store and auth flows:** ordinary-account Keeper and
   Breeder purchases, restore/reinstall, upgrade/cancellation/refund/expiration,
   account switching, confirmation and password recovery. Callback configuration
   and webhook TEST delivery cannot substitute for this.
3. **Physical-device workflow checks:** camera-roll HEIC, photo save, collection
   care, private isolation, a two-account collection/ownership transfer and export.
4. **Deletion fulfillment:** the in-app form creates a tracked support request.
   The privacy policy promises deletion/anonymization within 30 days. Assign an
   operator and prove complete erasure/anonymization on a representative disposable
   account, including media and third-party retention. Ticket creation alone is
   not verified erasure.
5. **Moderation operations:** report handling, review response time, coverage of
   gallery/listing content, and abuse response need an acceptance pass. Forum/Q&A
   filtering and message blocking do not certify the entire moderation program.
6. **Product claims:** store screenshots must match enabled features. Native push,
   shipping provider checkout, supplies checkout, mentorship and giveaways are
   unavailable or incomplete. Production endpoint inventory found only the
   deliberately disabled shipping/supplies checkout calls without deployed handlers.

Keep `NATIVE_AUTH_REDIRECT_VERIFIED` unset until device confirmation/recovery
passes. Delivery evidence supports the webhook verification gate; retain separate
actual purchase evidence. Do not waive release checks merely to produce an archive.

For code ownership and release procedure, read [ENGINEERING.md](ENGINEERING.md).
For live identifiers, secrets by name, retries and purchase diagnosis, read
[BILLING.md](BILLING.md).
