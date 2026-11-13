# scripts/: what each one is, what runs it, what it writes

An index of everything directly in `scripts/`. Written 12 November 2026 by reading `package.json`, the workflow files in `.github/workflows/` and the comment at the top of each script. If a row and the script disagree, the script wins; fix the row. When you add a script, add its row.

How to read the "What runs it" column:

- **`pnpm build`** means it is a step of the build, so it runs on every Vercel deploy and in CI. The steps, in order: `check-env`, `build-content-dates`, lint, the unit tests, `build-sitemap`, `build-agent-data`, `build-mcp`, `build-llms-full`, `build-morphs-csv`, `build-vercel-json`, the Vite build, `prerender`, `seo-audit`.
- **A `pnpm` name** is a script in `package.json` that a person or a session runs.
- **A workflow name** is a file in `.github/workflows/`. Their schedules are in `docs/OPERATIONS.md`, section 5.
- **By hand** means nothing runs it for you.

## The index

| Script or folder | What it does | What runs it | What it writes |
|---|---|---|---|
| `agent-traffic-report.mjs` | Exports a week of AI crawler and assistant traffic for the weekly agent review | The `agent-traffic` workflow | `docs/agent-review/<date>.json` |
| `backfill-morph-embeddings-local.py` | Makes Morph ID photo fingerprints on a local machine, one per animal, with no Replicate limits | By hand (see "Morph ID operations" below) | Embeddings on photo rows in the production database |
| `backfill-morph-embeddings.mjs` | Asks the `embed-gecko-image` function to fingerprint verified photos that have none | `pnpm backfill:morph-embeddings`; `deploy-morph-id.sh --backfill` | Embeddings in the production database, through the function |
| `backfill-stripe-overage-line.mjs` | One-time: adds the social post overage price to every existing Stripe subscription | By hand. **Do not run it:** overage is paused, and a subscription with two items cannot switch plan (`docs/BILLING.md`, "Stripe") | Live Stripe subscriptions |
| `blog/` | The blog pipeline: research, draft, publish, the weekly report and their emails | The `blog-pipeline` workflow, by hand only. **Shelved: do not run** | Blog posts and `docs/blog-reports/` |
| `build-agent-data.mjs` | Builds the files AI agents and dataset indexes read: the Price Index, morphs, genetics, care and their catalog | `pnpm build`; `pnpm build:agent-data` | `public/data/` (`price-index.json`, `price-index.csv`, `morphs.json`, `genetics.json`, `care.json`, `index.json` and others) |
| `build-analytics-demo.mjs` | Builds the Market Analytics design demo as one HTML file for design review | `pnpm build:analytics-demo`, by hand | One HTML file (the path you give it, or `market-analytics-demo.html` in its build folder) |
| `build-content-dates.mjs` | Works out, from git, when each public page last changed, for the sitemap and the structured data | `pnpm build`; `pnpm build:content-dates` (run this one in a full clone now and then, and commit the result) | `scripts/content-dates.json` |
| `build-geo-followup-pdf.mjs` | Lays out the follow-up list from an old search audit as a PDF | By hand | `GEO-follow-up.pdf` |
| `build-llms-full.mjs` | Builds the full text of the care and morph guides for AI crawlers | `pnpm build`; `pnpm build:llms-full` | `public/llms-full.txt` |
| `build-mcp.mjs` | Bundles the MCP server's tools so Vercel can run them | `pnpm build`; `pnpm build:mcp` (after changing `mcp/core.js`) | `api/_lib/mcp-core.js` (committed) |
| `build-morphs-csv.mjs` | Builds the open morph dataset as a CSV | `pnpm build`; `pnpm build:morphs-csv` | `public/morphs.csv` |
| `build-sitemap.mjs` | Builds the sitemap from the route list | `pnpm build`; `pnpm build:sitemap` | `public/sitemap.xml` |
| `build-vercel-json.mjs` | Builds Vercel's settings: redirects for retired pages, the Content Security Policy with a hash for each inline script, and the list of real addresses | `pnpm build`; `pnpm build:vercel-json`. Run it by hand after retiring a page, adding a morph or editing an inline script in `index.html` | `vercel.json`, and through `write-known-paths.mjs` `api/_lib/known-path-patterns.js` (both committed) |
| `build-weekly-notes.mjs` | Checks every Weekly Gecko Note against the writing rules and builds the catalog `send-email` ships with | `pnpm build:weekly-notes`, by hand after adding or changing a note | `supabase/functions/_shared/weekly-notes.generated.ts`; adds new slugs to `content/weekly-notes/published-slugs.json` |
| `bundle-budget.json` | Data, not a script: the size limits and the agreed exceptions, each with its reason | Read by `check-bundle-size.mjs` and `shrink-images.mjs` | Nothing. Edited by hand |
| `canary/` | The daily health check: signs in as the evaluation account, checks value estimates, runs two real Morph IDs, checks the market feed is fresh | The `daily-canary` workflow | Nothing. A failed run emails the repo owner |
| `changelog/` | Turns the week's commits into the in-app "What's New" | The `weekly-changelog` workflow | A row in the `change_logs` table, and an email when the email secrets are set |
| `check-bundle-size.mjs` | The size budget: fails when the main script, a page or a picture in `public/` is over its limit | The `ci` workflow, after the build. By hand: `pnpm build && node scripts/check-bundle-size.mjs` | Nothing |
| `check-csp-hashes.mjs` | Checks every built page's inline scripts against the Content Security Policy | By hand, after a build. A unit test (`src/lib/__tests__/cspHashes.test.js`) uses its code on every test run | Nothing |
| `check-doc-links.mjs` | Finds links between documents that point at nothing | By hand, after moving or renaming a document (`--paths` also lists missing file paths) | Nothing |
| `check-env.mjs` | Says whether each public build variable is present, and fails a production build when a required one is missing. It never prints a value | `pnpm build` (the first step) | Nothing |
| `check-genetics-consistency.mjs` | Fails when the guides, emails or AI prompts contradict the genetics engine or the husbandry numbers | `pnpm check:genetics`; the `ci` workflow | Nothing |
| `check-morph-id.sh` | Read-only probe of the Morph ID tables, database functions and edge functions | By hand (see below) | Nothing |
| `content-dates.json` | Data, not a script: the page dates `build-content-dates.mjs` wrote | Read by the sitemap, the prerender, `build-llms-full.mjs` and the SEO audit | Nothing. Generated; commit it, do not edit it |
| `csp-inline.mjs` | Shared code: finds a page's inline scripts and works out their hashes | Imported by `build-vercel-json.mjs` and `check-csp-hashes.mjs` | Nothing |
| `deploy-morph-id.sh` | Deploys three Morph ID edge functions by hand and can start the embedding backfill | By hand. **Read the warning below before running it** | The three deployed functions |
| `deploy-push-notifications.sh` | Deploys `send-push` and `send-email` by hand and prints one-time database commands. Both functions are declared, so a merge already deploys them | By hand; rarely needed now | The two deployed functions |
| `error-triage/` | Reads recent errors from `error_logs`, asks Claude for fixes and files them as GitHub issues | The `error-triage` workflow, by hand only since 15 October 2026 | GitHub issues; `docs/error-triage-state.json` |
| `eval-morph-id.mjs` | Grades Morph ID against a labelled test set. A full run costs about $6 and needs Tennyson's OK (`docs/RULES.md`, section 6) | `pnpm eval:morph-id`; `morph-id-eval/run-ci.mjs` | A results file, when given a path |
| `eval-morph-retrieval.py` | Measures how well photo matching finds the right morph, holding out each test animal's breeder | By hand (see below) | Nothing; prints the result |
| `gen-gecko-reference.sh` | Asks Replicate for a line drawing of a crested gecko, the base layer of the Morph Visualizer (which is retired) | By hand | `./gecko-base.png` |
| `generate-pdfs.mjs` | Builds the Care Guide and Genetics Guide PDFs behind the "Download PDF" buttons and the guides email | `pnpm build:pdfs`, by hand | `public/downloads/geck-inspect-care-guide.pdf`, `public/downloads/geck-inspect-genetics-guide.pdf` |
| `growth/` | Shared code for the growth report: Google Analytics, Search Console, and the blog queue feed | Imported by `growth-report.mjs` | Nothing by itself |
| `growth-report.mjs` | The weekly traffic and search report | The `growth-report` workflow | `docs/growth-reports/<date>.md`. Since 13 November 2026 it no longer adds search gaps to `docs/blog-queue.json` (the blog is shelved); `GROWTH_FEED_BLOG_QUEUE=1` switches that back on |
| `lib/` | Shared code for the scripts: the Weekly Gecko Notes rules, accepted facts, agent content, photo GPS reading, loading app code from Node. Has its own tests | Imported by other scripts and by unit tests | Nothing |
| `local/` | Files for Tennyson's Mac only: a weekly `git pull --ff-only` and the launchd files that schedule it | Installed by hand on the Mac | Nothing in the repository |
| `mcp/` | The source of the public MCP server's tools (`core.js`) | Bundled by `build-mcp.mjs` | Nothing |
| `morph-id-eval/` | The Morph ID test sets, the evaluation account helper and the CI runner. Has its own `README.md` | The `morph-id-eval` workflow, by hand only | Nothing in the repository |
| `photo-gps-audit.mjs` | Finds member photos that still carry the place they were taken. A second mode (`--strip`) removes it | By hand. The audit is read-only. **Do not run the strip until backups are running** (`docs/RULES.md`, section 6) | A report file; with `--strip --apply`, the photos in Storage |
| `precompute-trait-layers.mjs` | Builds the Morph Guide's pattern-study layers from the ink drawings in `art/morph-guide/ink-studies-v3` | By hand after changing a drawing; a test fails until you do | `public/morph-guide/trait-layers-v1/`, `src/components/morphguide/traitLayers.generated.js` (commit both) |
| `prerender.mjs` | Writes a static HTML page for every public address, so search engines and AI crawlers can read them without JavaScript | `pnpm build`; `pnpm build:prerender` | HTML files in `dist/` |
| `safe_image_download.py` | Shared code: downloads a public picture safely (no redirects, no private addresses) | Imported by `backfill-morph-embeddings-local.py` | Nothing |
| `seo-audit.mjs` | Checks every prerendered page's title, description, canonical address and structured data | `pnpm build` (the last step); `pnpm audit`; `pnpm audit:strict`; the `seo-audit` and `seo-audit-weekly` workflows | `docs/seo-audits/<date>.md` and its data file |
| `seo-lighthouse.mjs` | Adds Google PageSpeed scores to the newest SEO audit report | The `seo-audit` workflow | The newest report in `docs/seo-audits/` |
| `seo-routes.mjs` | Shared code: the list of public addresses | Imported by the sitemap, the prerender, `build-vercel-json.mjs`, `write-known-paths.mjs` and `build-content-dates.mjs` | Nothing |
| `shrink-images.mjs` | Shrinks every picture in `public/` that is over the 200 KB limit, in place | `pnpm shrink:images` (`--dry-run` only lists them) | The pictures in `public/` (commit the result) |
| `sql-harness/` | Builds a local Postgres with every migration replayed, then runs the SQL tests in `supabase/tests/`. Has its own `README.md` | The `integration` workflow; by hand | A local test database only |
| `submit-indexnow.mjs` | Tells Bing and other search engines which addresses changed | The `indexnow-submit` workflow; `pnpm submit:indexnow` | Nothing in the repository |
| `test-clock-drift-shim.mjs` | Shared code: moves the clock inside the test runner | Loaded by `test-clock-drift.mjs` | Nothing |
| `test-clock-drift.mjs` | Reruns the unit tests 400 days ahead and 400 days back, to catch a test that reads today's date | `pnpm test:clock-drift`; the `ci` workflow | Nothing |
| `test_safe_image_download.py` | Tests for `safe_image_download.py` | By hand, with Python's unittest | Nothing |
| `vite-plugins/` | Two build-only plugins that make the icon and date libraries smaller in the built site | Loaded by `vite.config.js` | Nothing |
| `write-known-paths.mjs` | Writes the list of real addresses that the edge uses to answer 404 for anything else | Run by `build-vercel-json.mjs` | `api/_lib/known-path-patterns.js` (committed) |

Not scripts, but in the same place: this `README.md`.

One thing to know before running anything against production: database changes are never run by hand. Merging to `main` applies new migrations and deploys the declared edge functions (`docs/MIGRATIONS.md`).

## Morph ID operations

Two helpers for the Morph ID system (the `/Recognition` and `/Training` pages): one deploys, one checks.

### `deploy-morph-id.sh`

Deploys three edge functions by hand (`recognize-gecko-morph`, `embed-gecko-image` and `export-training-corpus`) and, when asked, backfills embeddings for verified photos that do not have one yet. It does not apply migrations: it prints "Skipping database migrations", because merging to `main` is what applies them.

**Warning: do not run it without Tennyson's say.** Two of the three functions, `embed-gecko-image` and `export-training-corpus`, are kept hand-deployed on purpose because the copies in the repository are newer than what production runs. Running this script deploys the repository copies and so changes how production behaves (`docs/INFRASTRUCTURE.md`, section 2; `docs/RULES.md`, section 6, rule 5). The third, `recognize-gecko-morph`, is declared in `supabase/config.toml`, so a merge already deploys it.

```bash
# Full deploy, no backfill:
scripts/deploy-morph-id.sh

# Full deploy + backfill up to 500 missing embeddings:
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<key> \
MORPH_EMBED_BACKFILL_KEY=<key> \
  scripts/deploy-morph-id.sh --backfill

# Preview what would happen without doing it:
scripts/deploy-morph-id.sh --dry-run
```

For a large one-time backfill on Apple Silicon without Replicate rate limits,
use the locally compatible encoder. It loads the exact
`openai/clip-vit-large-patch14` weights used by `krthr/clip-embeddings`, checks
cosine compatibility against an existing production vector, and stores one
representative image per animal while round-robining breeders within morphs:

```bash
uv run --with torch --with transformers --with pillow --with requests \
  scripts/backfill-morph-embeddings-local.py --validate --limit 5000
```

Measure the resulting bank without leaking a breeder's images into its own
test neighbors:

```bash
uv run --with numpy --with requests scripts/eval-morph-retrieval.py
```

### One-time setup (by hand, once)

1. Install the Supabase CLI and sign in.
2. `supabase link --project-ref <your-ref>`
3. The edge function secret `REPLICATE_API_TOKEN` must be set. `SIGLIP_MODEL` is optional and should stay unset: it overrides the pinned photo fingerprint model, and changing the model means fingerprinting every stored photo again (`docs/OPERATIONS.md`, section 2). Secrets are set in the Supabase dashboard, never pasted into a file or a chat.
4. The `vector` extension must be enabled in production (it is: `docs/INFRASTRUCTURE.md`, section 6).

### Steps the script leaves out

- **The training-data security rules.** `supabase/migrations/README_training_rls_prod.md` used to be applied by hand. It is now part of the baseline migration, and so is the `profiles.role` column its policies use, so there is nothing to apply. Do not run that SQL by hand.
- **Granting the expert reviewer role** to an account is still a manual step, and it changes who can do what, so it needs Tennyson's say:
  ```sql
  UPDATE profiles SET role = 'expert_reviewer' WHERE email = 'you@example.com';
  ```

### `check-morph-id.sh`

A read-only probe that checks every moving part. Safe to run at any time. It prints `PASS` or `FAIL` for each check and exits with an error if anything failed.

```bash
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_ANON_KEY=<anon key> \
SUPABASE_SERVICE_ROLE_KEY=<service key>  \
  scripts/check-morph-id.sh
```

`SUPABASE_SERVICE_ROLE_KEY` is optional. Without it, the check that the columns exist is skipped (the security rules hide the schema from the public key).

What it checks:

- **Schema:** `gecko_images` has every training and embedding column.
- **Database functions:** `gecko_image_stats`, `is_expert_reviewer`, `nearest_training_samples` and `review_gecko_image` can be called.
- **Edge functions:** all three answer with a sensible refusal on bad input, which shows they are deployed and reachable without making a real AI call.
- **Dataset:** prints the current total and verified counts.

### After a change to Morph ID

A change to `recognize-gecko-morph` reaches production when it is merged to `main`. Then run the check:

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... scripts/check-morph-id.sh
```

If a check fails, the message above it says which part is missing.
