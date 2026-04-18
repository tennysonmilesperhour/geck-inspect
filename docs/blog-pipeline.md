# Geck Inspect Blog Pipeline

Automated draft-and-review blog system. Three-times-a-week cadence. Human-in-the-loop via PR review before anything reaches `main`.

## One-time setup (required before first run)

Add three secrets in **GitHub → Settings → Secrets and variables → Actions → New repository secret**:

| Secret name          | Value                                                                |
|---|---|
| `ANTHROPIC_API_KEY`  | Claude API key — used by the research + draft + review agents         |
| `RESEND_API_KEY`     | Resend.com API key — used by the weekly report email. Sign up at [resend.com](https://resend.com) and create a key; the default sender `onboarding@resend.dev` works without DNS |
| `BLOG_REPORT_EMAIL`  | Recipient address for the weekly report                              |

Without `ANTHROPIC_API_KEY`, the whole pipeline no-ops (the research + draft scripts throw with a clear error). Without the Resend secrets, the weekly report still commits to the repo and opens a GitHub Issue — it just skips the email step.

## What runs, when

| Job            | Cron (UTC)          | What it does |
|---|---|---|
| `research`     | Mon/Wed/Fri 06:00   | Scrapes Reddit + MorphMarket + Google autocomplete + Pangea; uses Haiku 4.5 to score topics; appends 0-3 new topics to `docs/blog-queue.json`; commits. |
| `draft`        | Mon/Wed/Fri 07:00   | Picks the highest-scored `new` topic; uses Sonnet 4.6 to write a full structured draft + self-critique; writes `content/blog-drafts/<slug>/`; opens a **draft PR** labelled `blog-draft`. |
| `publish`      | on PR merge         | When a `blog-draft`-labelled PR merges, converts the draft markdown into a new `BLOG_POSTS` entry in `src/data/blog-posts.js`, deletes the draft dir, marks the queue entry `published`, commits to `main`. The regular `npm run build` step picks it up and regenerates sitemap + llms.txt + prerendered HTML + vercel.json rewrites. |
| `weekly-report`| Monday 12:00        | Generates `docs/blog-reports/YYYY-Www.md` + commits; opens a GitHub Issue with the same content; emails the report to `BLOG_REPORT_EMAIL`. |

Manually trigger a stage with **Actions → blog-pipeline → Run workflow** and pick the stage.

## File layout

```
.github/workflows/blog-pipeline.yml   — cron + PR trigger + publish
content/blog-drafts/<slug>/           — ephemeral, deleted on publish
  post.md                             — full draft markdown
  metadata.json                       — title, description, tldr, faq, links
  self-critique.md                    — agent's self-review + auto-review notes
docs/blog-style-guide.md              — voice + structural rules (cached into every draft run)
docs/blog-voice-examples.md           — reference writers (cached)
docs/blog-queue.json                  — topic queue, one row per topic
docs/blog-queue.schema.json           — schema for the above
docs/blog-budget.json                 — weekly spend ledger (committed)
docs/blog-reports/                    — weekly markdown reports (committed)
docs/blog-reports/_latest-research.json — sidecar for the weekly report
docs/blog-reports/_latest-draft.json    — sidecar for the draft workflow
docs/blog-reports/_latest-report.json   — sidecar for the weekly workflow
scripts/blog/research.mjs             — topic scorer
scripts/blog/draft.mjs                — writer + self-review
scripts/blog/publish.mjs              — markdown → BLOG_POSTS entry
scripts/blog/weekly-report.mjs        — weekly report
scripts/blog/lib/
  anthropic.mjs                       — Claude client + caching + budget
  budget.mjs                          — $10/week ledger + kill switch
  fact-check.mjs                      — canonical genetics corpus loader
  sources/reddit.mjs                  — Reddit hot/new/top-week
  sources/morphmarket.mjs             — MorphMarket new-listings trait counter
  sources/google-ac.mjs               — Google autocomplete long-tail tree
  sources/pangea.mjs                  — Pangea crested-gecko forum index
```

## How to review a draft PR

Each draft PR is opened as a **draft** PR with the `blog-draft` label.

In the PR body you'll see:

- The draft title + slug.
- Links to `post.md`, `self-critique.md`, `metadata.json`.

Open `self-critique.md` first. The writer agent flags what it's least confident about, and a second Sonnet pass flags style-guide violations and unsupported claims. If that file reads "everything's fine," be suspicious — that's usually a sign the agent didn't look hard.

Three actions you can take:

- **Edit the markdown directly on the PR**, then **mark as ready for review** and merge. The publish job converts the edited markdown.
- **Close the PR without merging.** The topic stays in the queue with `status: drafted`. If you want the pipeline to learn from the rejection, edit `docs/blog-queue.json` to set `status: rejected` and add a `rejectionReason`.
- **Merge as-is.** If the draft is clean enough, approve and merge. Publish fires automatically.

There is no `/revise` command yet — if you want the agent to take another pass on the same topic, manually revert the queue entry to `status: new` and wait for the next draft slot.

## Budget

Hard cap: **$10/week** USD, enforced in `scripts/blog/lib/budget.mjs`. Any API call that arrives with the current week's total at or above the cap throws `BudgetExceededError`; scripts catch that and exit cleanly, waiting for the next week.

Every Claude call is logged in `docs/blog-budget.json` — per-model, per-stage, with per-call entries. The weekly report surfaces the largest single calls.

Typical weekly spend if the pipeline runs nominally (3 research + 3 draft + 3 review + 1 weekly report):

| Stage          | Model       | Approx. per-call | × per week | Weekly est. |
|---|---|---|---|---|
| research score  | Haiku 4.5   | ~$0.05–0.10 | 3 | ~$0.20 |
| draft write     | Sonnet 4.6  | ~$0.20–0.40 | 3 | ~$0.90 |
| draft critique  | Sonnet 4.6  | ~$0.05–0.10 | 3 | ~$0.20 |
| weekly report   | Sonnet 4.6  | ~$0.05      | 1 | ~$0.05 |
| **Total**       |             |             |   | **~$1.35** |

That's with cold-cache runs. Prompt caching on the ~30K-token style guide + voice examples + fact-check corpus should pull the draft cost down further — verify in the weekly report's `cache_read_input_tokens` numbers.

If spend is routinely above $5/week you have either a runaway scorer (check queue growth) or a stuck draft agent (check open PRs). If spend is below $1/week and quality is fine, great — that's headroom for adding a second reviewer pass or longer drafts.

## Adjusting behaviour

| Want to... | Edit this |
|---|---|
| Change voice / tone | `docs/blog-voice-examples.md` — pasted into every draft run |
| Change structural rules (hooks, forbidden phrases, length) | `docs/blog-style-guide.md` |
| Raise / lower cadence | Cron expressions in `.github/workflows/blog-pipeline.yml` |
| Raise / lower budget cap | `WEEKLY_CAP_USD` in `scripts/blog/lib/budget.mjs` |
| Swap models | `MODELS` constants in `scripts/blog/lib/anthropic.mjs` |
| Change topic score threshold | `MIN_SCORE_TO_KEEP` in `scripts/blog/research.mjs` |
| Add / remove sources | Add a new `scripts/blog/lib/sources/<name>.mjs` and wire it into `research.mjs` |
| Integrate Foundation Genetics as the primary fact-check | `SOURCES` array in `scripts/blog/lib/fact-check.mjs` — prepend the new module |

## When the pipeline fails

The workflow runs are visible under **Actions → blog-pipeline**. Common failures and the fix:

| Symptom | Cause | Fix |
|---|---|---|
| `ANTHROPIC_API_KEY is not set` | Secret missing or not named exactly that | Add at repo → Settings → Secrets → Actions |
| `Anthropic rate-limited (…)` | Bursty runs sharing the same org key | Lower cadence or wait; retries happen on next slot |
| Research job completes with no new topics added | Scorer didn't find anything clearing `MIN_SCORE_TO_KEEP` | Normal on slow weeks. If repeated for 2+ weeks, lower the threshold or widen sources. |
| Draft job errors with `model did not call the "write_draft" tool` | Sonnet refused the task (rare) or the schema is malformed | Check the run logs; usually a topic with missing evidence fields |
| Publish job errors with `Cannot find closing "];"` | `src/data/blog-posts.js` was hand-edited in a way that broke the array terminator | Fix `blog-posts.js` to end with `];` on its own line |
| Weekly email doesn't arrive | Resend secret missing or domain not verified | Check `RESEND_API_KEY`; use `onboarding@resend.dev` sender until you verify a domain |

## Ethical + ToS notes

- **Reddit:** public JSON endpoints, read-only, low volume (< 10 req/min). User-Agent identifies the bot. Compliant with Reddit's [public content policy](https://www.redditinc.com/policies/public-content-policy).
- **MorphMarket:** fetches one category index page per run, no auth, no listing-detail crawling. User-Agent identifies the bot. If MorphMarket ops asks us to stop, contact email is in the UA string.
- **Google autocomplete:** public suggest API, ~10 queries per run.
- **Pangea Reptile forum:** public forum index, no login, one page per run.
- **Facebook / Discord:** deliberately skipped. Facebook groups + Discord servers are signal-rich but the ToS story is messy; not worth automating until we have explicit permission from each source.

If any source operator asks us to stop scraping, remove the relevant source file and the research agent will proceed with the others.
