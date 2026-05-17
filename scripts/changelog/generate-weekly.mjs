#!/usr/bin/env node
/**
 * Weekly "What's New" generator. Runs every Monday at 13:00 UTC (9 AM EDT,
 * 8 AM EST) via .github/workflows/weekly-changelog.yml.
 *
 * Flow:
 *   1. Pull git log for the past 7 days on main.
 *   2. Hand it to Claude with instructions to GROUP related commits into
 *      themed bullets, skip internal/refactor noise, and keep the voice
 *      friendly and user-relevant.
 *   3. Insert a published row into public.change_logs via the Supabase REST
 *      API using the service role key (bypasses RLS).
 *   4. Optionally email a "this week's update is live" notice via Resend.
 *
 * Idempotency: if a change_logs row already exists with published_date in
 * the last 6 days, the script exits 0 without inserting. Safe to re-run.
 *
 * Required env (set as repo secrets in GitHub Actions):
 *   ANTHROPIC_API_KEY          Claude API key
 *   SUPABASE_URL               https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  service role key (NOT the anon key)
 *
 * Optional env:
 *   RESEND_API_KEY             Resend API key for email notification
 *   BLOG_REPORT_EMAIL          recipient (reuses blog pipeline secret)
 *   BLOG_FROM_EMAIL            sender (defaults to onboarding@resend.dev)
 *   DRY_RUN=1                  print the entry but don't insert
 *   FORCE=1                    insert even if a recent entry exists
 *
 * Exit codes:
 *   0 = success (or skipped because a recent entry exists, or nothing to ship)
 *   1 = hard failure
 */
import { execSync } from 'node:child_process';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-6';

function shellOut(cmd) {
  return execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
}

function collectCommits() {
  // Last 7 days on the current branch (main in CI). Newest first.
  const log = shellOut(
    `git log --since="7 days ago" --no-merges --pretty=format:"%h|%ad|%s" --date=short`
  ).trim();
  if (!log) return [];
  return log.split('\n').map((line) => {
    const [hash, date, ...rest] = line.split('|');
    return { hash, date, subject: rest.join('|') };
  });
}

function weekLabel(now) {
  const month = now.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const year = now.getUTCFullYear();
  // Week-of-month based on the Monday this update covers (yesterday from cron's POV).
  // Use the date of the most recent Monday to anchor the label.
  const monday = new Date(now);
  const dayOfWeek = monday.getUTCDay(); // 0 = Sunday, 1 = Monday
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);
  const weekNum = Math.ceil(monday.getUTCDate() / 7);
  return {
    weekLabel: `${month} ${year}, Week ${weekNum}`,
    title: `Week of ${month} ${monday.getUTCDate()}`,
    weekStart: monday,
  };
}

async function summarizeWithClaude(commits, weekLabelText) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.');
  const client = new Anthropic({ apiKey });

  const commitList = commits
    .map((c) => `${c.date} ${c.hash} ${c.subject}`)
    .join('\n');

  const systemPrompt = `You write the weekly "What's New" entry for Geck Inspect, a crested-gecko management app.

Your job is to turn a raw week of git commits into a short, friendly, user-facing summary that shows up in the dashboard's "What's New" tab.

VOICE
- Plain language. Talk like a human, not a release-notes bot.
- Lead with the user benefit, not the implementation. ("Notification bell now opens a quick popup" beats "Refactored notification component").
- Past-tense or simple-present action verbs: Added, Fixed, Improved, Faster, Now you can.

GROUPING (this is the most important rule)
- COMBINE related commits into single themed bullets. If there are 8 commits about the sidebar, write ONE bullet about sidebar improvements.
- Aim for 4 to 8 bullets total. Never more than 9.
- A reader should be able to skim the list in 20 seconds and understand the shape of the week.

SKIP
- Pure internal work: refactors, lint fixes, dependency bumps, CI config, test changes, typo fixes that don't change behavior.
- Auto-generated commits like "blog: refresh topic queue" or "blog: publish <slug>" UNLESS the count is interesting (then mention "Published N new blog posts this week" once).
- Reverts where the original change was also in the same week (treat as a no-op).
- Commits with no user-visible effect.

PUNCTUATION (hard rule for this codebase)
- DO NOT use em dashes ( the long horizontal dash ). They are banned project-wide.
- DO NOT use en dashes or double-hyphens as substitutes.
- Use commas, periods, parentheses, or colons instead. Rewrite sentences to avoid the dash structure entirely.
- Hyphens in compound words (well-known, drop-down, crested-gecko-first) are fine.

CRESTED GECKO CONTEXT
- This is a crested-gecko-first app. When morphs come up, use the specific names: Lilly White, Harlequin, Phantom, Cappuccino, Axanthic, Sable, Highway. Never generic "reptile" examples.

OUTPUT
Return JSON: { "title": "Week of <Month> <Day>", "bullets": ["...", "..."] }
The title is already provided in the user message; echo it back exactly. Just produce the bullets.`;

  const userPrompt = `Week label: ${weekLabelText}

Git commits from the past week (newest first):

${commitList}

Generate the user-facing bullets following the rules. Group aggressively.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    tools: [
      {
        name: 'emit_weekly_update',
        description: 'Emit the user-facing weekly update bullets.',
        input_schema: {
          type: 'object',
          required: ['title', 'bullets'],
          properties: {
            title: {
              type: 'string',
              description: 'Echo the title back exactly as provided.',
            },
            bullets: {
              type: 'array',
              minItems: 1,
              maxItems: 9,
              items: { type: 'string' },
              description: 'User-facing bullet points, themed and grouped.',
            },
          },
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'emit_weekly_update' },
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse) {
    throw new Error(`Claude did not call the tool. stop_reason=${response.stop_reason}`);
  }
  return toolUse.input;
}

function stripDashes(text) {
  // Defense in depth: even if Claude slips, scrub em/en dashes from output
  // before it hits the database. Em dash to comma, en dash to hyphen,
  // double-hyphen pair to comma. Hyphens in words are untouched because
  // they're not surrounded by spaces.
  return text
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*--\s+/g, ', ')
    .replace(/\s+--\s*/g, ', ')
    .replace(/–/g, '-');
}

async function recentEntryExists() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.');
  const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `${url}/rest/v1/change_logs?select=id,published_date&is_published=eq.true&published_date=gte.${encodeURIComponent(sixDaysAgo)}&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) {
    throw new Error(`Supabase select failed ${res.status}: ${await res.text()}`);
  }
  const rows = await res.json();
  return rows.length > 0;
}

async function insertEntry({ title, weekLabel: wl, bullets }) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const body = {
    title,
    week_label: wl,
    bullet_points: bullets,
    is_published: true,
    published_date: new Date().toISOString(),
    raw_notes: 'auto-generated by scripts/changelog/generate-weekly.mjs',
    created_by: 'changelog-bot',
  };
  const res = await fetch(`${url}/rest/v1/change_logs`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Supabase insert failed ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function sendEmail({ title, bullets }) {
  const { RESEND_API_KEY, BLOG_REPORT_EMAIL, BLOG_FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !BLOG_REPORT_EMAIL) {
    console.log('[changelog] Resend secrets not set, skipping email.');
    return;
  }
  const body = [
    `This week's "What's New" entry is live on the dashboard.`,
    '',
    title,
    ...bullets.map((b) => `  ,  ${b}`),
    '',
    'Users see it in the What\'s New tab next time they open the dashboard.',
    'Edit or unpublish at /AdminPanel?tab=changelog.',
  ].join('\n');
  const from = BLOG_FROM_EMAIL || 'Geck Inspect changelog bot <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [BLOG_REPORT_EMAIL],
      subject: `Geck Inspect: ${title} is live in the dashboard`,
      text: body,
    }),
  });
  if (!res.ok) {
    console.error(`[changelog] Resend ${res.status}: ${await res.text()}`);
  } else {
    console.log('[changelog] Sent notification email.');
  }
}

async function main() {
  const dryRun = process.env.DRY_RUN === '1';
  const force = process.env.FORCE === '1';

  if (!force && !dryRun && (await recentEntryExists())) {
    console.log('[changelog] Recent entry already exists (within 6 days). Skipping.');
    return;
  }

  const commits = collectCommits();
  if (commits.length === 0) {
    console.log('[changelog] No commits in the past 7 days. Skipping.');
    return;
  }
  console.log(`[changelog] Found ${commits.length} commits to summarize.`);

  const now = new Date();
  const { weekLabel: wl, title } = weekLabel(now);

  const summary = await summarizeWithClaude(commits, wl);
  const cleanTitle = stripDashes(summary.title || title);
  const cleanBullets = (summary.bullets || []).map(stripDashes).filter(Boolean);

  if (cleanBullets.length === 0) {
    console.log('[changelog] Summarizer returned no bullets. Skipping.');
    return;
  }

  const entry = { title: cleanTitle, weekLabel: wl, bullets: cleanBullets };
  console.log('[changelog] Generated entry:');
  console.log(JSON.stringify(entry, null, 2));

  if (dryRun) {
    console.log('[changelog] DRY_RUN set, not inserting.');
    return;
  }

  await insertEntry(entry);
  console.log(`[changelog] Inserted "${cleanTitle}" into change_logs.`);
  await sendEmail({ title: cleanTitle, bullets: cleanBullets });
}

main().catch((err) => {
  console.error('[changelog] Fatal:', err);
  process.exit(1);
});
