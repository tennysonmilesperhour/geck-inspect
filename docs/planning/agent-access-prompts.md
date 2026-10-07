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

_Blocks are filled in from the 7 Oct survey below._
