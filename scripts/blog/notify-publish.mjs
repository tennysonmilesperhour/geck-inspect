#!/usr/bin/env node
/**
 * Email a "your post is live" notification after publish.mjs has rewritten
 * src/data/blog-posts.js and committed to main. The link points at the
 * production URL; Vercel typically promotes to production within ~90 seconds
 * of the push, so the link is live by the time the email arrives.
 *
 * Required env:
 *   RESEND_API_KEY     Resend API key
 *   BLOG_REPORT_EMAIL  recipient
 *
 * Optional env:
 *   BLOG_FROM_EMAIL    sender (defaults to onboarding@resend.dev)
 *
 * Usage: node scripts/blog/notify-publish.mjs <slug>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const SITE_ORIGIN = 'https://geckinspect.com';

function findEntry(slug) {
  // We don't bother JS-parsing blog-posts.js: it's append-only and the
  // metadata file we just wrote already has everything we need.
  const queue = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'docs', 'blog-queue.json'), 'utf8'));
  return queue.topics.find((t) => t.slug === slug) || null;
}

function findLatestDraftRecord(slug) {
  // The draft step writes the metadata, but publish.mjs deletes the draft
  // directory before this step runs. The queue entry preserves title/score,
  // and src/data/blog-posts.js holds the description; we grep for the slug
  // entry block in blog-posts.js to recover title + description.
  const src = fs.readFileSync(path.join(REPO_ROOT, 'src', 'data', 'blog-posts.js'), 'utf8');
  const re = new RegExp(`slug:\\s*['"\`]${slug.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}['"\`][\\s\\S]*?title:\\s*['"\`]([^'"\`]+)['"\`][\\s\\S]*?description:\\s*['"\`]([^'"\`]+)['"\`]`);
  const m = src.match(re);
  if (!m) return null;
  return { title: m[1], description: m[2] };
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: notify-publish.mjs <slug>');
    process.exit(2);
  }

  const { RESEND_API_KEY, BLOG_REPORT_EMAIL, BLOG_FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !BLOG_REPORT_EMAIL) {
    console.log('[notify-publish] Resend secrets not configured; skipping email.');
    process.exit(0);
  }

  const url = `${SITE_ORIGIN}/blog/${slug}`;
  const queueEntry = findEntry(slug);
  const metadata = findLatestDraftRecord(slug);
  const title = metadata?.title || queueEntry?.title || slug;
  const description = metadata?.description || '';
  const score = queueEntry?.score?.total ?? null;

  const subject = `Geck Inspect blog: "${title}" is live`;
  const lines = [
    `${title}`,
    '',
    `Live URL: ${url}`,
    description ? `Summary:  ${description}` : '',
    score !== null ? `Score:    ${score}` : '',
    '',
    'The full post is now on geckinspect.com/blog. No action needed.',
    '',
    'Pipeline ran fully autonomously: research, draft, sanitize (no em dashes),',
    'publish, and this email. Reply nothing required.',
  ].filter(Boolean).join('\n');

  const from = BLOG_FROM_EMAIL || 'Geck Inspect blog bot <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [BLOG_REPORT_EMAIL],
      subject,
      text: lines,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[notify-publish] Resend error ${res.status}: ${body}`);
    process.exit(1);
  }
  console.log(`[notify-publish] Sent live-link email for ${slug}.`);
}

main().catch((err) => {
  console.error('[notify-publish] Fatal:', err);
  process.exit(1);
});
