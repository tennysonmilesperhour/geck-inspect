# Agent access: being the source AI cites for crested geckos (7 Oct 2026)

Start here for anything about AI crawlers, AI assistants, llms.txt, the open data, the MCP server, or charging agents. The weekly agent review (below) updates the "Review log" at the end of this file.

## The goal

When someone asks ChatGPT, Claude, Perplexity, Gemini or any agent about crested geckos, the answer should come from Geck Inspect and link to it. That makes Geck Inspect the trusted reference, sends people to the site, and keeps the crested-gecko-first position visible everywhere answers are given.

## What the research found (7 Oct 2026)

- **llms.txt is cheap but rarely read by the big bots.** About 36,000 sites publish one, but an Ahrefs study found 97% of them got zero requests in May 2026. GPTBot and ClaudeBot mostly read HTML. Google said in June 2026 that Search, AI Overviews and AI Mode do not use it. Agents a person sends to a site (coding agents, assistants following a link) do read it. Keep it short and point to small topic files.
- **AI search cites original data, fresh pages and open pages.** Studies (Princeton GEO, Semrush, industry reports; quality varies) agree: statistics and original research get cited several times more, cited pages are fresher, and server-rendered, open content wins.
- **Paywalls kill citations.** In a 40-query test, hard-paywalled outlets got zero AI citations; open sources got 91%. Blocking AI crawlers cost news sites about 7% of traffic.
- **No major assistant pays per request today.** x402 (Coinbase's HTTP 402 payment standard) works and has middleware, but real agent payments are tiny (by April 2026 about $28K a day across all of x402, much of it wash trading, 0.6% to 7.5% of the commercial part from AI agents). Coinbase's facilitator fee beyond the free tier is roughly what a $0.001 request would earn (from memory, check docs.cdp.coinbase.com). Cloudflare Pay Per Crawl needs Cloudflare in front of the site and the AI company to sign up. ChatGPT, Claude and Perplexity pay publishers through deals and revenue pools, not per request.
- **Standards worth adopting now:** schema.org Dataset markup (Google Dataset Search; must be in the server HTML), a read-only remote MCP server, Content Signals in robots.txt. Worth watching: MCP server cards (`.well-known`, still a proposal), IETF aipref, RSL licensing. Skip: agents.json, ai-plugin.json (dead), NLWeb (early).

## Decision: open, not paywalled (for now)

Keep everything free and open. Charging $0.001 a request today would earn close to nothing (almost no agent pays), cost about as much in fees, and remove Geck Inspect from the answers that matter. Visibility in AI answers is worth far more than micropayments at this traffic.

What would change that, and the plan when it does:
1. **Bulk and history, not answers.** If someone wants the full price history, per-listing comps, time-to-sell or alerts (the Enterprise Market Intelligence data), sell an API key through Stripe. The free index stays coarse (one median per trait and market), so it advertises the paid product instead of replacing it.
2. **Agent payments when agents actually pay.** The MCP server is the place to add a paid tier: a `get_price_history` or `comps` tool behind x402 or Stripe machine payments, priced well above the facilitator fee (think $0.01 to $0.05 a call, not $0.001). The weekly review watches for agents that would pay (x402 headers, MCP clients asking for those tools).
3. **Licensing.** If an AI company offers a content deal or a revenue pool (Perplexity Comet Plus style), take it; it costs nothing to be listed. RSL is the format to publish if one appears.

## What shipped on 7 Oct

| Piece | Where | What it does |
|---|---|---|
| Geck Inspect Price Index | `public.open_price_index()`, `/data/price-index.json` and `.csv`, `/llms/prices.md` | Original data: median and middle half asking price by trait and market (US, KR, JP, EU) from the latest full check, plus monthly medians since May 2026. Refreshed on every deploy; the committed snapshot ships if the build cannot reach the database. |
| Live prices on pages | `src/components/public/PriceIndexTable.jsx` on `/crested-gecko-price` and `/data`; prerendered as a table for bots | The most-searched price page now carries current numbers, not only hand-written ranges. |
| Open data page | `/data` (`src/pages/OpenData.jsx`, `src/data/open-datasets.js`) | Human page plus DataCatalog and Dataset markup in the server HTML for Google Dataset Search. Footer link "Open Data". |
| Datasets | `/data/morphs.json`, `/data/genetics.json`, `/data/care.json`, `/data/index.json` | Every morph with identification, lookalikes and sources; the genetics engine's traits, combos and risky pairings; the care guide as structured blocks; a catalog. CORS open. |
| Markdown twins | `/MorphGuide/<slug>.md`, `/CareGuide/<id>.md` | Each page as clean markdown, linked from the HTML with `rel="alternate" type="text/markdown"`, with a canonical Link header back to the HTML page. |
| Topic files | `/llms/morphs.md`, `care.md`, `genetics.md`, `prices.md` | Each 30 to 60 KB, small enough for an agent to read whole. `/llms-full.txt` (367 KB) is kept. |
| llms.txt | `public/llms.txt` | Rewritten from 23 KB to 8 KB: how to cite, topic files, data, MCP, key facts, page list. Fixed a wrong Lilly White origin. |
| MCP server | `https://geckinspect.com/mcp` (`api/mcp.js`, tools in `scripts/mcp/core.js`, bundled by `scripts/build-mcp.mjs`) | Read-only, no key. Tools: `search_morphs`, `get_morph`, `list_care_topics`, `get_care_topic`, `get_prices`, `predict_pairing` (the calculator's own engine, with the lethal-pairing warnings). |
| Discovery | `/.well-known/api-catalog` (RFC 9727), `/.well-known/mcp/server-card.json` (proposal), robots.txt pointer | So agents that look for an API can find it. |
| Content Signals | `public/robots.txt` | `search=yes, ai-input=yes, ai-train=yes`. |
| Weekly traffic export | `public.agent_traffic_summary()`, `scripts/agent-traffic-report.mjs`, `.github/workflows/agent-traffic.yml` (Mondays 15:20 UTC) | Writes `docs/agent-review/YYYY-MM-DD.json` for the review and prunes rows older than 180 days. |
| AI traffic log | `public.agent_hits`, `public.log_agent_hit()`, `middleware.js`, `api/_lib/bots.js` | Every request from a known AI crawler, assistant, search engine or tool is logged (bot, kind, path, user agent). People are not logged. MCP tool calls log as `/mcp/<tool>`. Vercel's own logs expire too fast to answer "which bots read what". |
| Build | `scripts/build-agent-data.mjs`, `scripts/lib/agent-content.mjs`, `package.json` | Generated on every build; generated files are gitignored except the price index snapshot. |

Licensing as published: price, morph and genetics data CC BY 4.0 (free with attribution, which is what makes it citable). Care guide text: free to quote with a link, not to republish in full. Change in `src/data/open-datasets.js` and `scripts/build-agent-data.mjs` if Tennyson wants something else.

## Decisions for Tennyson

1. **Is publishing the coarse price index OK?** It is aggregate (counts and percentiles, never single listings or photos) and labelled as asking prices on public listings without naming the marketplaces. Market Intelligence is Enterprise only (decision 38); the free index is one median per trait and market, while Enterprise keeps age, sex and quality comps, time to sell, watchlists, alerts and the seller view. To turn it off: `revoke execute on function public.open_price_index() from anon, authenticated;` in the SQL editor, delete `public/data/price-index.json`, and remove the table from the two pages.
2. **The licence** above (CC BY 4.0 for data).
3. **Register the MCP server** in public directories once it has run for a week (the official MCP Registry, Smithery, mcp.so, PulseMCP). That is outward-facing, so it waits for a yes.

## The weekly agent review

A scheduled Claude session runs every Monday. Its job: learn what agents read and cite, then make the most valuable thing more original, more accurate and easier to use. It works on `main` like any session (CLAUDE.md rules apply, no em dashes, no blog posts).

1. **Traffic.** Read the newest `docs/agent-review/YYYY-MM-DD.json`, written 35 minutes earlier by the `agent-traffic` GitHub Action (`scripts/agent-traffic-report.mjs`, using the repo's Supabase secrets, so the review needs no database connector). It holds `public.agent_traffic_summary()` for 7 and 28 days (hits by bot and kind, top paths, agent-file use, unknown user agents, daily counts, the previous period), the live price index age, whether `/mcp` answers, and how many rows older than 180 days it pruned. Add real new bots to `api/_lib/bots.js`. If the file is missing, the Action failed: say so and check its run log. With a Supabase connector, `select public.agent_traffic_summary(7)` gives the same live.
2. **Citations.** Run web searches for 10 to 15 real crested gecko questions (the "Common questions" list below, plus whatever the traffic suggests) and note whether Geck Inspect is cited and who is cited instead. Google's numbers (Search Console queries and clicks) are in the newest `docs/growth-reports/` file, written by the Monday growth-report Action.
3. **Accuracy.** Check one area per week for contradictions between the morph guide, care guide, genetics engine, llms.txt, project lines and the price guide (rotate: morphs, care, genetics, prices). Fix wrong facts at the source. A wrong fact repeated by an AI is worse than no citation.
4. **Freshness and originality.** Confirm the price index refreshed (generated_at within 7 days; if not, say why: the US feed was off from early September). Compare hand-written price ranges with the index and flag big gaps (for example, the guide says Lilly White $500 to $3,000+ while the 6 Oct US median asking price is $400).
5. **Improve one thing.** Pick the single change most likely to raise citations or agent use, build it, verify with `pnpm build`, and push to main. Prefer: original data and stats agents cannot get elsewhere, clearer answers on pages that bots read, fixes to anything agents fail on.
6. **Report.** Add a dated entry to the Review log below (numbers, what changed, what is next) and keep the backlog current.

### Common questions to test

How much is a Lilly White crested gecko worth? Can you breed two Lilly Whites? What humidity does a crested gecko need? What size enclosure for an adult crested gecko? What is a Phantom crested gecko? Harlequin vs Extreme Harlequin? Is Axanthic recessive? When can I breed a female crested gecko? Do crested geckos need UVB? What is a Cappuccino crested gecko? Best app for tracking crested geckos? What morph is my crested gecko?

## Backlog (for the weekly review)

- Reconcile the Lilly White origin across the blog post (`src/data/blog-posts.js`, says ACR 2014), `src/data/project-lines.js` (says ACR still produces Super Lilly Whites, which are lethal) and the morph guide (Lilly Exotics, Nick Lumb, 2010). Fixed in llms.txt on 7 Oct.
- Put each morph's current asking prices on its HTML Morph Guide page (now only in the `.md` twin, the JSON and the MCP answer).
- Price index by age class and sex once there is enough data, and a monthly "state of the crested gecko market" stats page (numbers only, no blog post).
- Original stats from member data, aggregated and anonymous, once there are enough records: hatch rates, incubation days by temperature, weight by age. At least 50 records per number before publishing.
- An OpenAPI description for the `/data` files.
- Re-check the MCP server card format when the proposal settles; register in MCP directories (needs Tennyson's yes).
- When agents start paying anywhere relevant: a paid MCP tool (price history, comps) through x402 or Stripe.

## Outlook

- **1 year:** citations still come from open HTML and structured data; remote MCP servers become a normal way for agents to use a site; payments stay experimental. Win by being the most accurate and most original crested gecko source.
- **2 years:** one discovery standard for agent tools settles; Content Signals or aipref become something big labs honour; assistants may pay through licensing pools. Have clean data, a stable API and a track record of accuracy.
- **5 years:** agents are most of the traffic. Value goes to sources with provable data (where it came from, when) and tools agents can call. The crested gecko data no one else has (prices over years, lineage, outcomes of real pairings) is the asset; this work starts the record now.

## Review log

### 2026-10-07 (setup)

Shipped everything in "What shipped". The deploy went live about 06:15 UTC; bingbot and YandexBot were logged within minutes, both already fetching /data. Baseline: the AI traffic log starts today, so the first review has one week of data. Price index: 73 trait rows across 4 markets, 222 monthly rows; latest US full check 6 Oct (6,985 listings, median asking price $250).
