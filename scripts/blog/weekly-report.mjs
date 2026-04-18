#!/usr/bin/env node
/**
 * Weekly report — runs every Monday morning.
 *
 * Produces three artefacts:
 *   1. docs/blog-reports/YYYY-Www.md — committed markdown archive.
 *   2. A GitHub Issue opened by the workflow using this script's output.
 *   3. An email sent via Resend using this script's output.
 *
 * This script only writes the markdown file and a JSON sidecar the
 * workflow reads. Issue-creation and email-send live in the workflow
 * so secrets never leak into local runs.
 *
 * Report sections:
 *   - Headline metrics (posts published, queue depth, $ spent, avg score)
 *   - What shipped (slug, score, PR, published date)
 *   - What's in the queue (top N by score, with rationale from research)
 *   - Research signal summary (where topics came from)
 *   - Budget detail (per-model, per-stop, largest single calls)
 *   - What I'd change (auto-generated suggestions based on what happened)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isoWeekKey, weekSummary, currentWeekSpend } from './lib/budget.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const QUEUE_PATH = path.join(REPO_ROOT, 'docs', 'blog-queue.json');
const REPORTS_DIR = path.join(REPO_ROOT, 'docs', 'blog-reports');

function readJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (err) { if (err.code === 'ENOENT') return fallback; throw err; }
}

function startOfWeek(weekKey) {
  // Monday 00:00 UTC of the given ISO week
  const [year, wStr] = weekKey.split('-W');
  const week = parseInt(wStr, 10);
  const jan4 = new Date(Date.UTC(parseInt(year, 10), 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const result = new Date(mondayWeek1);
  result.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  return result;
}

function withinWeek(dateIso, weekKey) {
  if (!dateIso) return false;
  const d = new Date(dateIso);
  const start = startOfWeek(weekKey);
  const end = new Date(start); end.setUTCDate(start.getUTCDate() + 7);
  return d >= start && d < end;
}

function main() {
  // Reports are dated with the ISO week that just ended.
  const now = new Date();
  const lastWeekDate = new Date(now); lastWeekDate.setUTCDate(now.getUTCDate() - 7);
  const weekKey = isoWeekKey(lastWeekDate);
  const thisWeekKey = isoWeekKey(now);

  const queue = readJson(QUEUE_PATH, { topics: [] });
  const budget = weekSummary(weekKey) || { weekKey, totalUsd: 0, byModel: {}, byStop: {}, callCount: 0 };
  const currentBudget = currentWeekSpend();

  // Published last week.
  const publishedLastWeek = queue.topics.filter((t) =>
    t.status === 'published' && withinWeek(t.publishedAt, weekKey)
  );
  // Drafted last week (whether published or not).
  const draftedLastWeek = queue.topics.filter((t) =>
    t.draftedAt && withinWeek(t.draftedAt, weekKey)
  );
  // Currently in queue and not rejected/published.
  const inQueue = queue.topics.filter((t) => t.status === 'new' || t.status === 'scheduled')
    .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0));
  const rejectedLastWeek = queue.topics.filter((t) =>
    t.status === 'rejected' && withinWeek(t.draftedAt || t.createdAt, weekKey)
  );

  const avgScore = publishedLastWeek.length
    ? publishedLastWeek.reduce((s, t) => s + (t.score?.total ?? 0), 0) / publishedLastWeek.length
    : 0;

  // Signal summary pulled from the last research run stored on disk.
  const latestResearch = readJson(path.join(REPORTS_DIR, '_latest-research.json'), null);

  // Top-cost calls from the budget log.
  const biggestCalls = (latestBudgetLog(weekKey) || [])
    .slice().sort((a, b) => b.usd - a.usd).slice(0, 5);

  const suggestions = autoSuggest({
    publishedLastWeek, draftedLastWeek, rejectedLastWeek, inQueue, budget, currentBudget,
  });

  const md = renderMarkdown({
    weekKey, thisWeekKey, publishedLastWeek, draftedLastWeek, rejectedLastWeek,
    inQueue, budget, currentBudget, avgScore, latestResearch, biggestCalls, suggestions,
  });

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `${weekKey}.md`);
  fs.writeFileSync(reportPath, md);

  // Sidecar JSON for the workflow (so it can make the GH Issue body + email body without re-parsing markdown).
  const sidecar = {
    weekKey,
    reportPath: path.relative(REPO_ROOT, reportPath),
    generatedAt: now.toISOString(),
    stats: {
      published: publishedLastWeek.length,
      drafted: draftedLastWeek.length,
      rejected: rejectedLastWeek.length,
      queueDepth: inQueue.length,
      avgScore: round(avgScore, 2),
      budgetUsd: round(budget.totalUsd || 0, 4),
    },
    issueTitle: `Blog pipeline weekly report — ${weekKey}`,
    issueBody: md,
    suggestions,
  };
  fs.writeFileSync(path.join(REPORTS_DIR, '_latest-report.json'), JSON.stringify(sidecar, null, 2) + '\n');

  console.log(`[weekly-report] Wrote ${path.relative(REPO_ROOT, reportPath)}`);
  console.log(`[weekly-report] Stats: ${JSON.stringify(sidecar.stats)}`);
}

function latestBudgetLog(weekKey) {
  try {
    const ledger = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'docs', 'blog-budget.json'), 'utf8'));
    return ledger.weeks?.[weekKey]?.log || [];
  } catch { return []; }
}

function round(n, places) {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

function autoSuggest({ publishedLastWeek, draftedLastWeek, rejectedLastWeek, inQueue, budget, currentBudget }) {
  const out = [];
  if (publishedLastWeek.length === 0) {
    out.push('No posts published last week. Either the drafts weren\'t merged, or the draft agent skipped every slot. Check the blog-draft PRs — any still open?');
  }
  if (publishedLastWeek.length >= 3) {
    out.push('Target cadence met (3/week). Consider raising the queue score threshold to push quality up at the same cadence.');
  }
  if (rejectedLastWeek.length > publishedLastWeek.length) {
    out.push('More drafts rejected than published. Look at rejection reasons in the queue — pattern suggests the style guide or fact-check corpus needs a tweak.');
  }
  if (inQueue.length < 2) {
    out.push('Queue is running low. The next research pass will refill, but if this persists for two weeks, widen the source list (Discord, FB public pages) or lower the score threshold.');
  }
  if (inQueue.length > 15) {
    out.push('Queue is getting long. Either prune rejected entries or let the auto-cap trim the tail.');
  }
  if ((budget.totalUsd || 0) >= 9.5) {
    out.push('Budget was nearly exhausted last week. Consider bumping the cap in scripts/blog/lib/budget.mjs if content quality warrants it.');
  }
  if ((budget.totalUsd || 0) < 2) {
    out.push('Used less than 20% of the weekly budget. There\'s headroom for a second reviewer pass or longer drafts if desired.');
  }
  if (currentBudget.usd >= 5) {
    out.push(`Already $${currentBudget.usd.toFixed(2)} of this week's budget used before any reports were generated. Watch for runaway spend.`);
  }
  return out;
}

function renderMarkdown(ctx) {
  const {
    weekKey, thisWeekKey, publishedLastWeek, draftedLastWeek, rejectedLastWeek,
    inQueue, budget, currentBudget, avgScore, latestResearch, biggestCalls, suggestions,
  } = ctx;

  const lines = [];
  lines.push(`# Blog pipeline — weekly report ${weekKey}`);
  lines.push('');
  lines.push(`Generated ${new Date().toISOString()}.`);
  lines.push('');

  lines.push('## Headline');
  lines.push('');
  lines.push(`- **Posts published:** ${publishedLastWeek.length} (target 3/week)`);
  lines.push(`- **Posts drafted:** ${draftedLastWeek.length}`);
  lines.push(`- **Drafts rejected:** ${rejectedLastWeek.length}`);
  lines.push(`- **Queue depth:** ${inQueue.length}`);
  lines.push(`- **Avg published score:** ${avgScore.toFixed(2)}`);
  lines.push(`- **Spend last week:** $${(budget.totalUsd || 0).toFixed(4)} / $10.00`);
  lines.push(`- **Spend this week so far:** $${currentBudget.usd.toFixed(4)}`);
  lines.push('');

  lines.push('## What shipped');
  lines.push('');
  if (publishedLastWeek.length === 0) {
    lines.push('_Nothing published this week._');
  } else {
    lines.push('| Slug | Category | Score | Published |');
    lines.push('|---|---|---|---|');
    for (const t of publishedLastWeek) {
      lines.push(`| /blog/${t.slug} | ${t.category} | ${t.score?.total ?? '—'} | ${t.publishedAt?.slice(0, 10) || '—'} |`);
    }
  }
  lines.push('');

  lines.push('## In the queue');
  lines.push('');
  if (inQueue.length === 0) {
    lines.push('_Queue is empty. Next research pass will refill._');
  } else {
    lines.push('| Slug | Category | Score | Why |');
    lines.push('|---|---|---|---|');
    for (const t of inQueue.slice(0, 10)) {
      const firstAngle = (t.angleIdeas && t.angleIdeas[0]) ? t.angleIdeas[0].replace(/\|/g, '\\|') : '—';
      lines.push(`| ${t.slug} | ${t.category} | ${t.score?.total ?? '—'} | ${firstAngle} |`);
    }
  }
  lines.push('');

  lines.push('## Research signal health');
  lines.push('');
  if (!latestResearch) {
    lines.push('_No recent research snapshot on disk._');
  } else {
    lines.push(`Most recent research run: ${latestResearch.ranAt}`);
    lines.push('');
    lines.push(`- Reddit items:        ${latestResearch.signals.reddit ?? 0}`);
    lines.push(`- MorphMarket items:   ${latestResearch.signals.morphmarket ?? 0}`);
    lines.push(`- Google autocomplete: ${latestResearch.signals.googleAc ?? 0}`);
    lines.push(`- Pangea forum:        ${latestResearch.signals.pangea ?? 0}`);
    lines.push(`- Bluesky:             ${latestResearch.signals.bluesky ?? 0}`);
    lines.push(`- Google Trends:       ${latestResearch.signals.googleTrends ?? 0}`);
    lines.push(`- YouTube:             ${latestResearch.signals.youtube ?? 0}`);
    lines.push(`- Breeder blogs:       ${latestResearch.signals.breederBlogs ?? 0}`);
    if (latestResearch.signals.errors && latestResearch.signals.errors.length > 0) {
      lines.push('');
      lines.push('Source errors to investigate:');
      for (const e of latestResearch.signals.errors) {
        lines.push(`- ${e}`);
      }
    }
  }
  lines.push('');

  lines.push('## Budget detail');
  lines.push('');
  lines.push(`Spend per model:`);
  for (const [m, v] of Object.entries(budget.byModel || {})) {
    lines.push(`- ${m}: $${Number(v).toFixed(4)}`);
  }
  lines.push('');
  lines.push(`Spend per pipeline stage:`);
  for (const [s, v] of Object.entries(budget.byStop || {})) {
    lines.push(`- ${s}: $${Number(v).toFixed(4)}`);
  }
  lines.push('');
  if (biggestCalls.length > 0) {
    lines.push('Largest calls last week:');
    lines.push('');
    lines.push('| When | Stage | Model | USD | In (cache r / w / other) / Out |');
    lines.push('|---|---|---|---|---|');
    for (const c of biggestCalls) {
      lines.push(`| ${c.at} | ${c.stopLabel} | ${c.model} | $${c.usd.toFixed(4)} | ${c.cr} / ${c.cw} / ${c.in} / ${c.out} |`);
    }
  }
  lines.push('');

  lines.push('## Suggestions');
  lines.push('');
  if (suggestions.length === 0) {
    lines.push('_No automated suggestions this week — pipeline looks healthy._');
  } else {
    for (const s of suggestions) lines.push(`- ${s}`);
  }
  lines.push('');

  lines.push('## How to intervene');
  lines.push('');
  lines.push('- **Kill a bad topic:** edit `docs/blog-queue.json`, set the topic\'s status to `rejected` and add a `rejectionReason`.');
  lines.push('- **Force a specific topic next:** reorder `docs/blog-queue.json`; the draft agent picks highest-scored `new`/`scheduled` entry.');
  lines.push('- **Pause the pipeline:** disable the workflow in GitHub Actions UI (Settings → Actions → blog-pipeline).');
  lines.push('- **Adjust voice:** edit `docs/blog-voice-examples.md` — the writer agent picks it up on the next run.');
  lines.push('- **Adjust style rules:** edit `docs/blog-style-guide.md`.');
  lines.push('- **Adjust budget cap:** edit `WEEKLY_CAP_USD` in `scripts/blog/lib/budget.mjs`.');
  lines.push('');

  return lines.join('\n') + '\n';
}

main();
