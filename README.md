# Geck Inspect

The crested-gecko-first platform for breeders and keepers. Live at
https://geckinspect.com.

Collection management, breeding planning, AI morph identification,
multi-generation lineage, a verified breeder community, and reference
guides (morphs, care, genetics) built only for *Correlophus ciliatus*.

## Stack

- Vite 6 + React 18 single-page app (no Next.js, no server components)
- Tailwind + Radix UI
- Supabase: Postgres with row-level security, Auth, Storage, Edge
  Functions (Deno), pg_cron, Vault
- Stripe for memberships (checkout, webhook, customer portal), RevenueCat
  for the mobile shells
- Vercel for hosting; every push to `main` deploys production (pushes
  that only touch `docs/` or top-level Markdown files are skipped)
- Merging to `main` also applies new files in `supabase/migrations/` and
  deploys the edge functions declared in `supabase/config.toml`, through
  the Supabase GitHub integration (docs/MIGRATIONS.md)

## Working locally

```bash
pnpm install
cp .env.example .env.local   # fill in the public keys
pnpm dev                     # http://localhost:5173
pnpm lint && pnpm test && pnpm typecheck
pnpm build                   # also runs lint and tests, then prerenders every route
```

`pnpm build` writes the sitemap, llms-full.txt, vercel.json, the
prerendered HTML for every public route, and an SEO audit under
docs/seo-audits/. After editing content, run `pnpm build:content-dates`
so the sitemap's lastmod values reflect real change dates.

## Repository map

- `src/pages/` route components, `src/pages.config.js` the authenticated
  page map, `src/App.jsx` the public routes
- `src/lib/` shared logic (tier limits, Stripe config, telemetry, guest
  mode)
- `src/data/` the morph guide, care guide, project lines, blog posts
- `supabase/functions/` edge functions, one folder per function
- `supabase/migrations/` schema history (read docs/MIGRATIONS.md before
  touching it)
- `scripts/` build-time SEO tooling and the scheduled jobs' scripts
  (`scripts/README.md` covers only the Morph ID deploy helpers)
- `docs/` project context, decisions, specs, audits

## Rules that matter

- Work on `main`. No preview branches or pull requests unless asked. (The
  `error-triage` workflow files its proposed fixes as GitHub issues with
  the patch in the body; it pushes no branch. Its nightly schedule is off
  since 15 Oct 2026, so it only runs when started by hand. Dependabot
  opens weekly update pull requests.) Services, secrets and the scheduled
  jobs are listed in `docs/OPERATIONS.md`.
- No em dashes anywhere in copy, UI strings, docs, or comments.
- Crested gecko terminology stays specific (Lilly White, Harlequin,
  Phantom, Cappuccino, Axanthic, Sable, Highway).
- A different breeder shares Tennyson's first name and runs a similarly
  named site. It is not his brand and never appears in this product
  (CLAUDE.md names it under domain disambiguation).

Start with [the engineering guide](docs/ENGINEERING.md), then the
[billing runbook](docs/BILLING.md) and [current release evidence](docs/RELEASE_READINESS.md).
See CLAUDE.md for the full working agreement.

## Baseline checklist

```
[ ] private repo + main protected + CI   [x] dependabot + lockfile
[ ] advisors clean (or exceptions noted)  [ ] backups/PITR confirmed
[ ] PostHog + exceptions on               [ ] uptime incl. checkout URL
[ ] privacy / terms / contact (+refund/shipping/disclaimers if selling)
[ ] support@ email works                  [ ] domain auto-renew on
[ ] revenue lands in business account     [ ] sales tax configured (physical goods)
```

Dependabot and `pnpm-lock.yaml` are in the repo. The other boxes stay
open: this repository is public, branch protection is not recorded here,
and the rest is not something the repo can confirm.
