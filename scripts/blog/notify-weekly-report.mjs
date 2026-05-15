#!/usr/bin/env node
/**
 * Email the weekly pipeline report. Pulled out of the workflow YAML so the
 * inline heredoc shell script doesn't have to stay in sync with the email
 * payload shape (and so we can unit-test the email body locally).
 *
 * Required env:
 *   RESEND_API_KEY
 *   BLOG_REPORT_EMAIL
 *
 * Optional env:
 *   BLOG_FROM_EMAIL
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

async function main() {
  const { RESEND_API_KEY, BLOG_REPORT_EMAIL, BLOG_FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !BLOG_REPORT_EMAIL) {
    console.log('[notify-weekly] Resend secrets not configured; skipping email.');
    process.exit(0);
  }

  const sidecar = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'docs', 'blog-reports', '_latest-report.json'), 'utf8'),
  );
  const body = fs.readFileSync(sidecar.reportPath, 'utf8');

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
      subject: sidecar.issueTitle,
      text: body,
    }),
  });
  if (!res.ok) {
    console.error('[notify-weekly] Resend error:', res.status, await res.text());
    process.exit(1);
  }
  console.log('[notify-weekly] Sent weekly report email.');
}

main().catch((err) => {
  console.error('[notify-weekly] Fatal:', err);
  process.exit(1);
});
