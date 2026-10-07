# Agent access prompts for Tennyson's other repos (7 Oct 2026)

How to use: open a new Claude Code session on the repo, paste the **master prompt** below, then paste that repo's **customization block** under it. The master prompt carries everything learned on Geck Inspect; the block says what fits that repo and what to avoid. Each session reads the repo itself before building, so a block that has gone stale gets corrected, not followed blindly.

The reference build is Geck Inspect (public repo `tennysonmilesperhour/geck-inspect`, plan in `docs/planning/agent-access-2026-10.md`).

---

## Master prompt

```
Build an "agent access" layer for this project so AI assistants (ChatGPT, Claude, Perplexity, Gemini), AI crawlers and other automation can find, read, trust and cite it. Then set up a weekly review that keeps improving it. The customization block at the end of this message says what fits this repo; check it against the code before you act on it.

FIRST
- Read CLAUDE.md (and any docs it lists) and follow its rules over anything here: which branch to work on, PR rules, writing style (Tennyson's projects ban em dashes and en dashes in all copy, comments that become docs, and generated files), and anything shelved.
- Find the live domain, the stack (framework, hosting, database) and how the site is rendered. If the site is a single-page app, anything for bots must be in the server HTML (prerendered or static), not added by JavaScript.
- If this repo has no public website, or its content is private, personal or sensitive, stop after the fit check and report what would make sense instead (often: nothing, or only a README and an llms.txt for the code).

WHAT THE RESEARCH SAYS (Oct 2026; re-check anything that drives a decision)
- The big AI crawlers rarely read llms.txt and Google ignores it, but agents a person sends to a site do read it. Keep it short and point to small topic files. Server-rendered HTML pages stay the main surface.
- AI answers cite original data (numbers, stats, research nobody else has), fresh pages with visible dates, and open pages. Paywalled sources got no AI citations in one test.
- No major assistant pays per request. Do NOT paywall content or charge agents. If paid access ever makes sense, it is bulk or history data through a Stripe API key or a paid MCP tool priced well above payment fees (think $0.01 to $0.05 a call), later.
- Worth adopting: schema.org Dataset markup (Google Dataset Search), a read-only remote MCP server (Model Context Protocol, the standard assistants use to call tools), Content Signals in robots.txt. Skip agents.json and ai-plugin.json.

BUILD (adapt every piece to the stack; skip pieces that do not fit and say why)
1. Accuracy pass first. Look for contradictions between pages, data files and docs (dates, names, numbers, safety facts). Fix wrong facts at the source. A wrong fact repeated by an AI is worse than no citation.
2. llms.txt at the site root, under about 10 KB: what the site is, how to cite it, links to topic files, data and the MCP server, key facts, main pages. Topic files under /llms/ (each under about 60 KB so an agent reads it whole). An llms-full.txt is optional.
3. A markdown twin of each content page (same URL plus .md), generated at build time from the same data the page uses, linked from the HTML with <link rel="alternate" type="text/markdown"> and served with a Link rel="canonical" header back to the HTML page.
4. Original data. Find what this project knows that nobody else publishes and release it as open data: JSON and CSV under /data/, a catalog at /data/index.json, and a human /data page with DataCatalog and Dataset JSON-LD in the server HTML. Aggregate anything derived from users or scraped sources (counts, medians, never single records, never personal data, minimum sample sizes). Licence data CC BY 4.0 (credit required, which is what makes it citable) unless the block says otherwise; long-form guide text: free to quote with a link, not to republish in full.
5. A read-only MCP server at https://<domain>/mcp: stateless Streamable HTTP (POST one JSON-RPC message, JSON response; methods initialize, ping, tools/list, tools/call; notifications get 202; GET returns a short description). No key. 3 to 6 tools specific to this domain, each answer carrying the page URL to cite. Reuse the app's own logic and data rather than re-implementing it. Test every tool locally before pushing.
6. AI traffic log: a table (agent, kind, path, user agent, time), written by a hosting middleware only for known bots and tools (never people's browsers), through a small database function that trims inputs; reads restricted to admins and the service role. Kinds: training, search, assistant, seo, tool. If there is no database, say what you used instead.
7. robots.txt: allow AI crawlers, add `Content-Signal: search=yes, ai-input=yes, ai-train=yes` to the * group unless the block says otherwise, and a comment pointing agents at llms.txt, /data and /mcp. Add /.well-known/api-catalog (RFC 9727 linkset) listing /mcp and /data/index.json, and /.well-known/mcp/server-card.json.
8. Put the price, stats or other live data on the human pages that people search for, not only in the files.

WEEKLY REVIEW
9. A database function that summarizes the traffic log for N days (by bot and kind, top paths, agent-file and MCP use, unknown user agents, daily counts, previous period), callable only by the service role (check auth.role() and session_user; current_user is always the owner inside a security definer function).
10. A GitHub Action every Monday that calls it with the repo's existing secrets, checks the live data files and /mcp, prunes log rows older than 180 days, and commits docs/agent-review/YYYY-MM-DD.json to the working branch. Run it once with workflow_dispatch and confirm the file appears.
11. A plan doc (docs/planning/agent-access-YYYY-MM.md): goal, research, decisions, what shipped with file paths, the weekly review steps (read the export, test 10 to 15 real questions in web search and note who is cited, accuracy audit on a rotating area, freshness check, build one improvement, log entry), common questions to test, a backlog, a 1/2/5 year outlook, and a Review log. Add a pointer to it in CLAUDE.md and a decision entry if the repo keeps a decision log.
12. A scheduled routine (create_trigger, a fresh session each firing, weekly, 35 minutes after the Action) whose prompt: attaches this repo with add_repo if it is not checked out, reads CLAUDE.md and the plan doc, follows the weekly review steps, follows decisions already recorded in the plan doc, and keeps anything else outward-facing as a recommendation. Stagger the time so it does not collide with other repos' reviews.

FINISH
- Run the repo's lint, tests and build. Check the pages at phone width. Push following the repo's rules. Confirm it is live (the traffic log getting rows is a good proof).
- Report to Tennyson in plain language, no jargon without a short explanation: what shipped, what you found (especially wrong facts), live checks, and the decisions only he can make (each with your recommendation).
```

---

## Customization blocks

Paste the block for the repo under the master prompt.

Every block below came from a read of the repo on 7 Oct 2026. The session checks it against the code before acting.

Review cadence and times are staggered so routines and their export Actions never collide (Geck Inspect owns Monday 15:20/15:55 UTC). "Light" means a monthly review instead of weekly, for sites with little to cite.

### Run these (good fit)

#### utah-forage-map (World Mushroom Foraging, worldmushroomforaging.org), fit: high

```
CUSTOMIZATION: utah-forage-map
- Site: worldmushroomforaging.org. React + Vite + Mapbox frontend, Python FastAPI backend on Vercel, Neon Postgres. No CLAUDE.md: follow PRODUCT.md and DESIGN.md (guest-first, protect places and people, never imply the map confirms a mushroom is edible).
- Citable content: 108 prerendered species guides (frontend/content/species), foraging guides (content/foraging), the 113-plant herbal atlas (The Verdant Hours), ten regional collections, the public read API.
- Original data to publish: monthly seasonality per species and hemisphere, regional fruiting outlooks, the 90-day field signal, lookalike pairs with cited safety notes. Aggregated only: never exact coordinates (public points are already shifted 1 to 2.5 miles), private logbooks, owner IDs or unreviewed submissions.
- iNaturalist-derived data: check per-record licences and credit iNaturalist and observers before redistributing; leave out records whose licence does not allow it. Use CC BY 4.0 only for what you are allowed to relicense.
- MCP tools: search_species, get_species_guide (with lookalikes and the safety warning), seasonality(species, region), in_season_near(region), approximated or aggregated locations only.
- Every agent-facing output carries: "A map observation is not an identification. Never eat a wild mushroom based on this data."
- Do NOT build: any tool or text that answers "is this edible", photo identification over MCP, exact locations.
- Database: Neon, not Supabase. Put the traffic log table and summary function there, with the FastAPI backend writing it.
- Review: weekly, Monday 16:25 UTC (export Action 15:50).
```

#### i-ching-app (The Free I Ching, thefreeiching.com), fit: high, needs prerendering first

```
CUSTOMIZATION: i-ching-app
- Site: thefreeiching.com. Vite + React SPA on Vercel (catch-all to index.html), Base44 backend, PostHog, iOS build via Capacitor. No CLAUDE.md and no robots.txt, sitemap or llms.txt today, and crawlers see an almost empty page.
- First job: prerender one static page per hexagram (64 pages, plus trigram and method pages) so bots get real HTML, then add robots.txt and a sitemap.
- Original content: the modern judgment, image and counsel text in src/lib/hexagramInterpretations.js. The changing-line text in src/data/classicalLines.json is CC0 from jesshewitt/i-ching; credit it as THIRD_PARTY_TEXT.md says.
- Dataset: the 64 hexagrams (King Wen number, trigrams, names, original summaries) as JSON and CSV with Dataset markup.
- MCP tools: get_hexagram(number or name), get_trigram, cast_reading (random cast with changing lines, clearly labelled a reflection tool, not a prediction).
- Do NOT touch: journal entries and readings (user data in Base44). Never imply readings predict the future.
- No database of its own besides Base44: log bots from Vercel middleware into a small store you choose (say which), or skip the log and say why.
- Review: weekly, Monday 16:55 UTC (export Action 16:20).
```

#### geck-data (Geck Intellect, geck-data.vercel.app), fit: high, static only, coordinate with geck-inspect

```
CUSTOMIZATION: geck-data
- Site: geck-data.vercel.app (also geckintellect.geckinspect.com). Next.js 14 App Router + TypeScript + D3 on Vercel. Uses the geck_data schema in the geck-inspect Supabase project (mmuglfphhwlaluyfyxsp). Rules: push straight to main, no PRs, run tsc --noEmit first, add files one by one, ask before destructive changes, NEVER add or replay migrations here (all migrations go in geck-inspect).
- geck-inspect already has the Price Index (/data), markdown twins, an MCP server at geckinspect.com/mcp and the bot log (public.agent_hits). Do not duplicate them: link to them, and add only what geck-data uniquely has (composite indices for Lilly White, Axanthic and Cappuccino, fair price, market temperature, trait frequency, the methodology).
- Crawlers already drained the Supabase Disk IO budget. Everything for bots must be static and precomputed (JSON/CSV files built on deploy or by a scheduled job). No live-query endpoints for bots. Keep robots.ts blocking /combo, /trait and filtered URLs.
- Dataset: precomputed index series with Dataset markup; markdown twins for morph and index pages only; llms.txt pointing to /methodology and the index pages.
- Log bots into the existing public.agent_hits through public.log_agent_hit() (one shared log; the weekly export in geck-inspect can add a site column later). Ask Tennyson before any schema change, which belongs in geck-inspect anyway.
- Legal: the site republishes scraped MorphMarket listings, photos and seller names. Do not expose more of that to agents, and flag it in your report as a risk for Tennyson to decide on (aggregates are much safer than listing pages).
- Decision to raise: robots.txt disallows /api/ while /api-docs documents public endpoints.
- Review: fold into geck-inspect's Monday review (add a geck-data section to its plan doc) instead of a separate routine.
```

#### ai-catch-up, fit: medium-high, mostly in place

```
CUSTOMIZATION: ai-catch-up
- Product: $49 AI onboarding for solo founders. Next.js 15 + Tailwind v4 + MDX on Vercel, no database. Live domain: check NEXT_PUBLIC_SITE_URL (falls back to ai-catch-up.vercel.app).
- Already has: app/llms.txt/route.ts, a sitemap, robots.txt allowing 12 AI bots. Build on them, do not replace them.
- Rules from CLAUDE.md: no em dashes (run npm run voice-check), never edit /content/ unless HANDOFF.md says so or Tennyson asks directly, the stack is locked, use the dev branch CLAUDE.md names and merge to main as it describes.
- Add: markdown twins for guides, glossary and blog; the glossary as a DefinedTermSet dataset with Dataset markup; Content Signals; the bot log (no database: pick a small store and say which, or log through Vercel and explain the limit); weekly review.
- MCP: optional, small (search_glossary, get_guide). Skip it if it means new copy.
- Do NOT write new copy outside the HANDOFF process, and keep /data/subscribers.json, the admin area and PAID_EMAILS private.
- Review: light (monthly), first Tuesday 15:55 UTC.
```

#### mythic-labs (mythiclabs.studio), fit: medium

```
CUSTOMIZATION: mythic-labs
- Two things in one repo: the Mythic Labs studio site (static HTML: mythic_labs_landing.html, showcase.html; domain mythiclabs.studio, check how it is deployed) and the "mythic-brain" Claude Code plugin marketplace (marketplace.json, 5 plugins).
- Rules from CLAUDE.md: skill descriptions are a contract, skill bodies stay under about 150 lines, bump the plugin version when behaviour changes.
- Site: llms.txt plus a methodology topic file (Threefold Path, the comparison with traditional agencies), a markdown twin of the manifesto, Organization/ProfessionalService JSON-LD, Content Signals.
- Marketplace: it is already agent-facing. Make marketplace.json and every skill description accurate and clean.
- Good addition: a dev-workflows skill that packages this agent-access playbook (the master prompt in geck-inspect docs/planning/agent-access-prompts.md) so any repo can run it.
- Skip: datasets and a site MCP (no data). Keep comms, inbox and client material out.
- Review: light (monthly), first Tuesday 16:25 UTC.
```

#### vibe-check, fit: low to medium

```
CUSTOMIZATION: vibe-check
- App: private journal about how people and habits affect you, with somatic practices. vibe-check-flame-nu.vercel.app (no custom domain yet). Vite + React, Supabase project shared with Daily Digest, Campground and Dialogue, Vercel.
- Rules from CLAUDE.md: open a PR, self code-review, squash-merge once CI is green; plain voice, no persona, no "we"; lint and build before committing; the Supabase project is shared, so reconcile migration history before any db push; respect the tight Content-Security-Policy in vercel.json.
- Add: llms.txt and markdown twins of the /help-now practices (full instructions plus a safety note and crisis line), Content Signals, the bot log, optionally one MCP tool get_practice(state) for the eleven practices matched to stress states.
- The brand promise is "No AI reads your journal". Nothing may touch journals, reports or anything about people. No datasets. No medical claims.
- Review: light (monthly), first Tuesday 16:55 UTC.
```

#### kiwipop (Kiwi Pop, www.kiwipop.fun), fit: medium, after a claims review

```
CUSTOMIZATION: kiwipop
- Store: functional "party supplement" lollipops. Next.js 14 on Vercel (Hobby plan: one cron a day), Supabase, Stripe, Resend, ShipStation. Rule: open PRs as non-draft and squash-merge right away.
- Already has: public/llms.txt, robots.ts allowing AI bots, a sitemap.
- FIRST: review every claim agents can read (llms.txt says things like "does not interact with alcohol" and "not psychoactive") against FDA rules for supplements and foods. List anything risky for Tennyson with a safer wording; change only what is clearly a factual error. Flavor names (Molly, Mary, Luci) read as drug references to an AI; flag, do not rename.
- Add: Product and Offer markup and markdown twins for product pages (ingredients, allergens, coconut as a tree nut, price), a stockist and event feed, Content Signals, the bot log.
- Do NOT add: an MCP server, open datasets, or any new health or function claim. Keep orders, customers, recipes, costs and financials private.
- Review: light (monthly), first Tuesday 17:25 UTC (mind the one-cron limit: run the export from GitHub Actions, not Vercel cron).
```

#### ClearPath, fit: medium, once it has a real domain

```
CUSTOMIZATION: ClearPath
- Product: AI check that validates loan applications for non-bank mortgage lenders before underwriting, explicitly no credit decisions. Static HTML (index, app, dashboard) plus Vercel functions and Supabase (applications, findings, leads). The README describes a Python/FastAPI tree that is not in the repo.
- Domain is unclear (Netlify homepage field, a vercel.json, hello@clearpath.ai in the README). If there is no confirmed live domain, stop after the fit check and say what is needed.
- Add: llms.txt and topic files (how validation works, the no-credit-decisions stance, the error types it catches), markdown twins of the landing page and an FAQ, Content Signals blocking /app, /dashboard and /api, the bot log.
- Dataset only from synthetic or anonymized demo data, for example a taxonomy of common loan-file error types. Never real submissions.
- Regulated area (fair lending, ECOA): nothing may read as credit advice. Keep applicant data and the internal research file private.
- Skip the MCP server until there is a product.
- Review: light (monthly), first Wednesday 15:55 UTC.
```

#### switchboard, fit: low (signals and a summary only)

```
CUSTOMIZATION: switchboard
- App: social plans (invite waves, private group polls, mutual-interest matching). switchboard-hqk2.vercel.app, Next.js 16, Supabase, Vercel, Claude API, Twilio.
- Rules (AGENTS.md via CLAUDE.md): batch commits into one locally checked push, do not use CI as the test loop; read docs/SECURITY.md before auth or database work and docs/AUTH.md before sign-in work; every user-facing error gets an SB- code; this is not the Next.js you know, read node_modules/next/dist/docs first; main deploys only through the migration workflow.
- Add only: a short llms.txt, a markdown twin of /features generated from src/lib/features.ts, robots.txt with `Content-Signal: search=yes, ai-input=yes, ai-train=no`, and the bot log.
- Keep invite and share pages out of crawler reach. No MCP, no datasets: contacts, invites, location and relationship signals are private.
- Review: light (monthly), first Wednesday 16:25 UTC.
```

#### dialogue, fit: low (marketing site only)

```
CUSTOMIZATION: dialogue
- Product: iOS app that wraps watched-app sessions in an intention gate and a debrief. It never blocks, and no usage data leaves the device. The marketing site and waitlist are in web/ (Next.js). Read docs/CONTEXT.md first; CLAUDE.md rules: no em dashes, no exclamation points, no emoji, no guilt copy (run python3 scripts/copy_lint.py), log decisions in docs/DECISIONS.md, CI runs on every pull request.
- Scope is web/ only: llms.txt, a markdown twin of the main page and an FAQ (how the gate and debrief work, the privacy stance), Content Signals, the bot log if the site has a backend you can use without touching user data.
- Nothing about any user's sessions or ledger. No MCP, no datasets.
- Review: light (monthly), first Wednesday 16:55 UTC.
```

### Later (no live site yet)

- **cairn** (Wasatch trail dataset, Phase 0). When there is a site: per-trail pages with markdown twins, an open trail dataset that credits OpenStreetMap under ODbL (share-alike, so not CC BY), an MCP tool find_trails(near, max_gain), the bot log. Never user GPS tracks, never imply trail safety or conditions. Its docs may live on a claude/ branch.
- **realestate-intake** (Foyer). Only if it ships for a real agent: llms.txt and a "how intake works" FAQ, Content Signals blocking /portal, /dashboard and /api. Never an MCP or dataset; never log chat content.

### Do not run (keep these away from AI systems or there is nothing to cite)

- **psilocin-valley**, **dailydigest**: no agent access. If anything, robots.txt with `Content-Signal: search=yes, ai-input=no, ai-train=no` and no llms.txt. Drug-adjacent and private health data respectively.
- **shroom** (Shroom OS): a grow-operation backend for Isaac's operation, not a public site. Not applicable.
- **alexandria**, **burnout**, **media-ops-scripts**, **hermes-jobs**, **eyeinthesky**, **geckfunnel**, **claude-config**, **dotfiles-claude**, **librechat-config**: private tools, configs or internal material. Not applicable.
- **hermes-jobs** could later post every repo's weekly agent-review summary to Slack in one message.

## Things the survey found that need Tennyson (outside this work)

1. **geckfunnel is a public repo** holding sales strategy, prompts and PIPELINE_TRACKER.xlsx (may contain breeder handles and emails). It also presents tennyscrestedgeckos.com as Tennyson's brand (CLAUDE.md treats that as a bug) and has an em dash in its page title. Recommendation: make it private, then fix the domain.
2. **eyeinthesky is a public repo** that documents capturing MorphMarket data from logged-in pages. Recommendation: make it private.
3. **geck-data publicly republishes scraped listings, photos and seller names.** That is the largest legal exposure in the Geck stack. Recommendation: show aggregates publicly and keep listing-level pages members-only.
4. **kiwipop's llms.txt** makes health-adjacent claims that should be checked against FDA rules.
