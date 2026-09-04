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
- Vercel for hosting; every push to `main` deploys production

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
- `docs/` project context, decisions, specs, audits

## Rules that matter

- Work on `main`. No preview branches or pull requests unless asked.
- No em dashes anywhere in copy, UI strings, docs, or comments.
- Crested gecko terminology stays specific (Lilly White, Harlequin,
  Phantom, Cappuccino, Axanthic, Sable, Highway).
- `tennyscrestedgeckos.com` is a different breeder. It never appears in
  this product.

See CLAUDE.md for the full working agreement.
