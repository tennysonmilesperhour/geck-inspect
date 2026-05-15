#!/usr/bin/env node
/**
 * Send a short email when a blog-pipeline stage fails. Without this we go
 * weeks without a publish and only notice when the queue dries up.
 *
 * Required env:
 *   RESEND_API_KEY     Resend API key
 *   BLOG_REPORT_EMAIL  recipient
 *   RUN_URL            link to the GitHub Actions run
 *
 * Optional env:
 *   BLOG_FROM_EMAIL    sender (defaults to onboarding@resend.dev)
 *
 * Usage: node scripts/blog/notify-failure.mjs <stage-name>
 */

async function main() {
  const stage = process.argv[2] || 'unknown';
  const { RESEND_API_KEY, BLOG_REPORT_EMAIL, BLOG_FROM_EMAIL, RUN_URL } = process.env;
  if (!RESEND_API_KEY || !BLOG_REPORT_EMAIL) {
    console.log('[notify-failure] Resend secrets not configured; skipping email.');
    process.exit(0);
  }

  const subject = `Geck Inspect blog pipeline failed: ${stage}`;
  const body = [
    `Stage:  ${stage}`,
    `Run:    ${RUN_URL || '(no link)'}`,
    '',
    'The blog pipeline failed during this stage. The run logs at the URL',
    'above have the stack trace. Most failures here are transient (Anthropic',
    'API blip, GitHub push race, source rate limit) and the next scheduled',
    'run will pick up where this one stopped.',
    '',
    'If failures recur on consecutive runs, investigate:',
    '  - Anthropic key valid and within rate limits',
    '  - docs/blog-budget.json under the weekly cap',
    '  - research sources still returning data (check _latest-research.json)',
  ].join('\n');

  const from = BLOG_FROM_EMAIL || 'Geck Inspect blog bot <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [BLOG_REPORT_EMAIL], subject, text: body }),
  });
  if (!res.ok) {
    const msg = await res.text();
    console.error(`[notify-failure] Resend error ${res.status}: ${msg}`);
    // Don't fail the outer job on email failure: we're already in the failure path.
    process.exit(0);
  }
  console.log(`[notify-failure] Sent failure email for stage=${stage}.`);
}

main().catch((err) => {
  console.error('[notify-failure] Fatal:', err);
  process.exit(0);
});
