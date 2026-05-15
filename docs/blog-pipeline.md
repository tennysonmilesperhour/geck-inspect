# Geck Inspect Blog Pipeline

Fully autonomous blog system. Research, draft, sanitize, publish, and notify happen inside a single workflow run on a Mon/Wed/Fri cadence. No PR review step, no manual merge. An email lands when a post goes live.

## One-time setup (required before first run)

Add three secrets in **GitHub, Settings, Secrets and variables, Actions, New repository secret**:

| Secret name          | Value                                                                |
|---|---|
| `ANTHROPIC_API_KEY`  | Claude API key, used by the research + draft + review agents |
| `RESEND_API_KEY`     | Resend.com API key, used by publish + failure + weekly emails. Sign up at [resend.com](https://resend.com) and create a key; the default sender `onboarding@resend.dev` works without DNS |
| `BLOG_REPORT_EMAIL`  | Recipient address for live-post and failure emails |

Optional:

| Secret name        | Value |
|---|---|
| `BLOG_FROM_EMAIL`  | Sender override (e.g. `Geck Inspect <blog@geckinspect.com>`); defaults to `onboarding@resend.dev` |

Without `ANTHROPIC_API_KEY`, the whole pipeline no-ops. Without the Resend secrets, posts still publish to `main`, the emails just no-op.

## What runs, when

| Job             | Cron (UTC)         | What it does |
|---|---|---|
| `research`      | Mon/Wed/Fri 06:00  | Pulls signal from Google autocomplete, Bluesky, Google Trends, YouTube, Pangea Reptile blog, and Reddit (r/crestedgecko + r/morphmarket). Uses Haiku 4.5 to score topics. Appends 0-3 new topics to `docs/blog-queue.json` and commits. |
| `draft-publish` | Mon/Wed/Fri 07:00  | Picks the highest-scored `new` topic, has Sonnet 4.6 write a structured draft, runs the em-dash sanitizer, runs a self-critique pass, converts the markdown into a `BLOG_POSTS` entry in `src/data/blog-posts.js`, commits to `main`, and emails `BLOG_REPORT_EMAIL` with the live URL. |
| `weekly-report` | Monday      12:00  | Generates `docs/blog-reports/YYYY-Www.md`, commits, opens a GitHub Issue, emails the report. |

Manually trigger a stage at **Actions, blog-pipeline, Run workflow** and pick the stage.

The Vercel production deploy runs on every push to `main`, so a typical live URL is ready within 90 seconds of the commit (well before the email lands).

## File layout

```
.github/workflows/blog-pipeline.yml   cron + draft + publish + notify
content/blog-drafts/<slug>/           ephemeral, deleted on publish
  post.md                             draft markdown
  metadata.json                       title, description, tldr, faq, links
  self-critique.md                    agent's self-review + auto-review notes
docs/blog-style-guide.md              voice + structural rules (cached into every draft run)
docs/blog-voice-examples.md           reference writers (cached)
docs/blog-queue.json                  topic queue, one row per topic
docs/blog-queue.schema.json           schema for the above
docs/blog-budget.json                 weekly spend ledger (committed)
docs/blog-reports/                    weekly markdown reports (committed)
docs/blog-reports/_latest-research.json  sidecar for the weekly report
docs/blog-reports/_latest-draft.json     sidecar for the draft step
docs/blog-reports/_latest-report.json    sidecar for the weekly step
scripts/blog/research.mjs             topic scorer
scripts/blog/draft.mjs                writer + sanitizer + self-review
scripts/blog/publish.mjs              markdown -> BLOG_POSTS entry, with sanitizer defense
scripts/blog/weekly-report.mjs        weekly report
scripts/blog/notify-publish.mjs       emails the live URL after each publish
scripts/blog/notify-failure.mjs       emails on any workflow failure
scripts/blog/notify-weekly-report.mjs emails the weekly report
scripts/blog/lib/
  anthropic.mjs                       Claude client + caching + budget
  budget.mjs                          $10/week ledger + kill switch
  fact-check.mjs                      canonical genetics corpus loader
  sanitize.mjs                        em-dash / en-dash / double-hyphen sweep
  sources/google-ac.mjs               Google autocomplete long-tail tree
  sources/bluesky.mjs                 Bluesky search (api.bsky.app, no auth)
  sources/google-trends.mjs           Google Trends rising + top related (cookie-warmed)
  sources/youtube.mjs                 YouTube search page (ytInitialData scrape)
  sources/breeder-blogs.mjs           Pangea Reptile blog RSS/Atom
  sources/reddit.mjs                  r/crestedgecko + r/morphmarket feeds and search
```

## What "fully autonomous" means here

Nothing in the post-research path requires a human. Specifically:

1. **No draft PR step.** Earlier versions of this pipeline opened a draft PR and waited for manual review. That stalled the queue when the operator forgot to review. The current pipeline drafts, sanitizes, and publishes in one job.
2. **Em-dash safety net.** CLAUDE.md treats em dashes as a hard "this is AI" tell. The writer system prompt forbids them; `lib/sanitize.mjs` strips em dashes, en dashes, and double-hyphen punctuation; `publish.mjs` refuses to write the entry if any residual dashes survive. Three defenses in series.
3. **Build verification before push.** `node --check src/data/blog-posts.js` runs before `git push`. A broken append would fail this step and block the push instead of breaking production.
4. **Failure email on every stage.** Any non-zero exit from research, draft-publish, or weekly-report sends a notification with a link to the run logs. Silent failures are the failure mode we care about most.
5. **Stale-draft tolerance.** The publish step deletes the `content/blog-drafts/<slug>/` directory after a successful publish, so a re-queued slug never collides with a leftover draft.

## Budget

Hard cap: **$10/week** USD, enforced in `scripts/blog/lib/budget.mjs`. Any API call that arrives at or above the cap throws `BudgetExceededError`; scripts catch it and exit cleanly until the next week.

Every Claude call is logged in `docs/blog-budget.json`, per-model, per-stage, with per-call entries. The weekly report surfaces the largest single calls.

Typical weekly spend if the pipeline runs nominally (3 research + 3 draft + 3 critique + 1 weekly report):

| Stage          | Model       | Approx. per-call | x per week | Weekly est. |
|---|---|---|---|---|
| research score  | Haiku 4.5   | ~$0.05-0.10 | 3 | ~$0.20 |
| draft write     | Sonnet 4.6  | ~$0.20-0.40 | 3 | ~$0.90 |
| draft critique  | Sonnet 4.6  | ~$0.05-0.10 | 3 | ~$0.20 |
| weekly report   | Sonnet 4.6  | ~$0.05      | 1 | ~$0.05 |
| **Total**       |             |             |   | **~$1.35** |

That's cold-cache. Prompt caching on the ~30K-token style guide + voice examples + fact-check corpus pulls the draft cost down further, verify in the weekly report's `cache_read_input_tokens` numbers.

If spend exceeds $5/week the most likely cause is a runaway scorer (queue growth) or a draft model that keeps retrying. If spend is under $1/week and quality is fine, that's headroom for adding a second reviewer pass or longer drafts.

## Adjusting behaviour

| Want to... | Edit this |
|---|---|
| Change voice / tone | `docs/blog-voice-examples.md`, pasted into every draft run |
| Change structural rules (hooks, forbidden phrases, length) | `docs/blog-style-guide.md` |
| Raise / lower cadence | Cron expressions in `.github/workflows/blog-pipeline.yml` |
| Raise / lower budget cap | `WEEKLY_CAP_USD` in `scripts/blog/lib/budget.mjs` |
| Swap models | `MODELS` constants in `scripts/blog/lib/anthropic.mjs` |
| Change topic score threshold | `MIN_SCORE_TO_KEEP` in `scripts/blog/research.mjs` |
| Add / remove sources | Add a new `scripts/blog/lib/sources/<name>.mjs` and wire it into `research.mjs` |
| Change sender or recipient | `BLOG_FROM_EMAIL` and `BLOG_REPORT_EMAIL` secrets |

## When the pipeline fails

The workflow runs are visible under **Actions, blog-pipeline**. Common failures and the fix:

| Symptom | Cause | Fix |
|---|---|---|
| `ANTHROPIC_API_KEY is not set` | Secret missing | Add at repo, Settings, Secrets, Actions |
| `Anthropic rate-limited (...)` | Bursty runs sharing the org key | Lower cadence or wait; the next slot retries |
| Research job completes with no new topics | Scorer didn't find anything clearing `MIN_SCORE_TO_KEEP` | Normal on slow weeks. If repeated for 2+ weeks, lower the threshold or widen sources. |
| Draft job exits with `Sanitizer left residual dashes` | Writer slipped a dash form past the sanitizer (rare) | Inspect the run log, extend `lib/sanitize.mjs` |
| `node --check src/data/blog-posts.js` fails | `publish.mjs` produced invalid JS | The push is blocked and the entry is rejected; inspect the diff in the run log and patch publish.mjs |
| Publish job exits with `Cannot find closing "];"` | `src/data/blog-posts.js` was hand-edited badly | Fix `blog-posts.js` to end with `];` on its own line |
| Weekly email doesn't arrive | Resend secret missing or domain not verified | Check `RESEND_API_KEY`; use `onboarding@resend.dev` sender until you verify a domain |
| `bluesky: 403 Forbidden` for every query | Bluesky changed host or auth requirement again | Inspect `lib/sources/bluesky.mjs`; current host is `api.bsky.app`. Past values: `public.api.bsky.app` |
| `explore: 429` for every Google Trends query | Trends cookie warmup got blocked | Check `lib/sources/google-trends.mjs`; the warmup hits `trends.google.com/trends/` to seed cookies |

## Ethical + ToS notes

- **Google autocomplete:** public suggest API, ~10 queries per run.
- **Bluesky:** public `searchPosts` XRPC endpoint via `api.bsky.app`, no auth, ~7 queries per run with built-in 429 backoff.
- **Google Trends:** two undocumented-but-public Trends RPCs (explore + relatedsearches), ~8 calls per run. Response shape can drift; source returns empty on parse failure.
- **YouTube:** scrapes the public search results page with a realistic browser UA and parses the embedded `ytInitialData` blob. Fragile by design; on failure we skip and move on.
- **Breeder blogs:** Atom feed published by the Pangea blog. Standard Shopify feed endpoint, no scraping.
- **Reddit:** public `.json` views of r/crestedgecko, r/morphmarket, plus in-subreddit search. Identifies itself with a contact URL in the User-Agent. ~10 requests per run, well under Reddit's 60/min ceiling.
- **Facebook / Discord:** deliberately skipped. Facebook groups + Discord servers are signal-rich but the ToS story is messy; not worth automating without explicit permission.

If any source operator asks us to stop scraping, remove the relevant source file and the research agent will proceed with the others.
