# Engineering guide

Start here after [README.md](../README.md). This guide describes the running
application and its integration boundaries. Historical plans under `docs/planning`
record intent; they are not evidence that a feature is deployed or verified.

## The product

Geck Inspect is the crested-gecko keeper and breeder workspace. A gecko record
connects collection care, weight and health history, breeding pairs and eggs,
lineage, public passports, marketplace listings, exports and optional AI tools.
Care and genetics reference content explains those workflows. Private records
stay private unless their owner explicitly publishes them.

Companion tools contribute evidence and distribution:

| Tool or service | Responsibility | Connection to Geck Inspect |
|---|---|---|
| Eye in the Sky | Collect listing observations | Feeds `geck_data`; observations are not confirmed sales or verified morph labels |
| Geck Intellect / geck-data | Market analysis and reference ingestion | Same Supabase project, `geck_data` schema; separate web deployment at geckintellect.geckinspect.com |
| Morph ID and training review | Identify candidate traits and review labeled examples | Uses metered edge functions, reference data and consented images; do not equate ingestion counts with a trained/evaluated model |
| Genetics calculator and visualizer | Model inheritance and possible appearance | Shared trait data and pairing logic; predictions are not guarantees about an individual animal |
| Stripe | Web memberships, invoices, billing portal | Protected profile membership fields |
| RevenueCat / Apple | Native memberships and store lifecycle | Verified entitlement mirror; see [BILLING.md](BILLING.md) |
| Promote | Generate and publish approved social content | Supabase social tables and server-side provider connections; native membership uses the same server tier |
| Govee integration | Enclosure readings | Paid, metered `iot-poll` function with caller-owned devices |
| Resend and web push | Notification delivery | Database notification dispatcher reads recipient preferences; clients do not send arbitrary email |
| Vercel | Web hosting, SEO output and API routes | Main deploys production; native binaries bundle the built web assets |

The market snapshot at `/data/market.json` is a separate contract from the public
reference-image views. Snapshot data includes provenance, dates and sample sizes.
Production load failures display unavailable states; development fixtures must be
labeled and must not become a release fallback. Shared ingestion inventory spans
species. Crested reference galleries use `Correlophus ciliatus` in external
reference data and `crested` in collector listings.

## Entry points and ownership

| Change | Start with |
|---|---|
| App shell and route access | `src/App.jsx`, `src/pages.config.js`, `src/Layout.jsx` |
| Auth and account identity | `src/lib/AuthContext.jsx`, `userProfile.js`, `supabaseClient.js` |
| Entity reads/writes | `src/api/supabaseEntities.js`, `src/entities/all.js`, `src/api/appClient.js` |
| Membership and quotas | `src/lib/tierLimits.js`, `nativeMembership.js`, `RevenueCatContext.jsx`, `docs/BILLING.md` |
| Animal saves and care history | `src/components/my-geckos/GeckoForm.jsx`, SQL `save_gecko_record` |
| Shared collections and transfers | `src/pages/CollectionInvite.jsx`, `ClaimAnimal.jsx`, collection/transfer RPCs |
| Genetics and reference content | `src/data/`, `src/lib/genetics/`, relevant calculator tests |
| Market evidence | `src/lib/geckDataClient.js`, `src/lib/marketAnalytics/`, `src/lib/constants.js` |
| Reporting and moderation | `src/components/support/ReportContent.jsx`, `admin/ContentModeration.jsx`, `src/hooks/useBlockedAuthors.js` |
| Native startup and callbacks | `capacitor.config.ts`, `src/lib/nativeAuth.js`, `ios/`, `android/` |
| Deployment and schema history | `docs/MIGRATIONS.md`, `supabase/config.toml`, `.github/workflows/` |

The page registry is explicit. A new file in `src/pages` does not create a route.
Register it, decide public/member/admin access, check `page_config`, and add the
navigation entry. A public page also needs the public route, metadata, sitemap
and prerender configuration. Essential membership/settings/login routes remain
available when optional feature flags are disabled.

## Account identity is a deliberate compatibility boundary

There are two identifiers. Do not interchange them:

- `user.id`: the legacy TEXT `profiles.id`, used by older tables such as image
  authorship. It can differ from the Auth UUID.
- `user.auth_user_id`: `auth.users.id`, used by RevenueCat, JWT/RLS and newer UUID
  tables. Resolve the profile by the authenticated email until the legacy
  identity migration is explicitly undertaken.

`loadUserProfile()` supplies the canonical enriched shape for AuthContext,
`User.me()` and `api.auth.me()`. It reads protected profile fields and the store
mirror. Editable `user_metadata` supplies display preferences, never the account
ID, admin role or membership. When changing accounts, AuthContext invalidates
pending enrichment, clears query/layout caches and remounts account-owned views.
Token refresh preserves the current profile while the same account reloads.

Use `useAuth()` inside React. Use the canonical loader through the facade when
imperative code needs a current user. For paid features, use `resolveTier()` in
the UI and `effective_tier_for_current_user()` on the server. A hidden button is
not authorization. Feature-credit RPCs use the real caller's JWT and choose
limits on the server.

## Data and side effects

Read [SCHEMA_CONVENTIONS.md](../supabase/SCHEMA_CONVENTIONS.md) before adding an
entity. Legacy table IDs, email ownership and `created_date` sorting coexist with
new UUID tables. Register exceptions in `ENTITIES_WITHOUT_CREATED_BY` and
`ENTITY_SORT_COLUMN`; otherwise generic CRUD generates invalid columns.

Keep an animal and its first weight save atomic through `save_gecko_record`.
Retries retain a request UUID. Optional notifications and analytics cannot turn a
successful core save into an apparent failure. The same rule applies to store
receipts: persist the receipt and all affected memberships together.

Public/private RLS is the authoritative boundary. Test as owner, unrelated member
and anonymous caller. Do not use service-role reads to prove client isolation.
Marketplace moderation unpublishes an animal (`is_public=false`); it must not
remove the owner's care and breeding records. Forum/Q&A blocking filters the
member's view and separately prevents messages in the database. Reports go to
the moderation inbox; human review still needs an assigned operator.

Notifications are records first, dispatched by the database using recipient
preferences. Never fetch another user's private profile to decide whether to
email them. Avoid duplicate client email calls after inserting a notification.

## How to leave code understandable

Use names that describe the domain: entitlement, Auth UUID, legacy profile ID,
observation, verified sale, collection member. Keep side-effect-free mapping and
validation close to tests, and keep provider/network calls at clear boundaries.
Document why a rule exists when it is surprising, such as identity compatibility,
grace periods, atomic saves or species-name differences. Do not narrate obvious
assignments with comments or retain TODOs that imply a finished feature.

Prefer an existing entity helper, shared tier resolver or transaction over a new
parallel implementation. Remove dead code when its replacement is verified.
Avoid broad formatting churn. When a contract changes, update the producer,
consumer, tests and this guide or the focused runbook in the same change.

## Verification and delivery

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm typecheck
pnpm check:genetics
pnpm build
```

`pnpm typecheck` is a limited syntax/structure gate with `checkJs` disabled. It
is not proof that the JSX application is fully typed. Vitest covers genetics,
pricing evidence, saves, billing semantics, identity and regression cases.
React provider tests deliberately finish old requests after sign-out/account
switching. Deno-check changed edge functions independently of the web build.

Database checks live in `supabase/tests/` and roll back their records. The launch
script checks private defaults, atomic animal/weight saves, vote ownership and
blocked messages. Billing scripts check duplicates, ordering, failure atomicity,
Keeper/Breeder/Enterprise precedence and RPC grants. Market combo tests compare
the optimized RPC with the existing public-view definition across five cases.

Work on main under the repository's current agreement. Before pushing, inspect
the diff, remove generated scratch material, and run appropriate gates. Vercel
executes the web build on every push; explicitly verify the production deployment
is Ready. Edge functions, migrations, secrets, auth URLs and store configuration
are separate deployment steps. Never infer that a file's presence means it is live.

## Native release and operational gates

The native identifier is `com.geckinspect.app`. Supabase now allows these exact
returns: `com.geckinspect.app://auth/callback` and the same URL with `?mode=reset`.
The canonical web auth site is `https://geckinspect.com`; `/MyGeckos` and
`/AuthPortal?mode=reset` are also allowed. iOS currently uses email/password;
web and Android also expose Google sign-in.

Build/sync uses `pnpm cap:sync`. `pnpm ios:release` checks the iOS SDK key, native
callback verification and webhook verification before opening Xcode. Keep
`NATIVE_AUTH_REDIRECT_VERIFIED` unset until confirmation and recovery complete on
a real device. Simulator compilation does not establish that PKCE survives the
email/browser/app handoff, that purchases work, or that Apple accepts the build.

Before submission, record a signed release build's purchase/restore and auth
results, camera/HEIC upload, ordinary-account collection/care/transfer/export,
private-data isolation and deletion. The in-app deletion card currently starts a
tracked support request; the published privacy policy promises deletion or
anonymization within 30 days. Assign ownership and verify actual fulfillment on
a disposable account. An open ticket is not completed erasure.

Hidden or unavailable capabilities are intentional release limits: shipping
provider checkout, supplies checkout, mentorship and giveaways are not complete
live services; native push is not implemented. Do not advertise them in store
screenshots. External publishing providers, moderation response operations,
refund/referral reconciliation and real device behavior require their own
acceptance evidence. Use [RELEASE_READINESS.md](RELEASE_READINESS.md) for current
verified results and remaining gates.
