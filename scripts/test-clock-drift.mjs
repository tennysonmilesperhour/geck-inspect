#!/usr/bin/env node
// Runs the unit tests twice more with the wall clock moved: 400 days
// ahead and 400 days back. A test that passes today but fails then is
// reading today's date somewhere it assumed a fixed one.
//
// Why it matters: `pnpm build` runs the tests, so a test like that does
// not fail when it is written. It fails weeks later, on the day its
// hidden assumption runs out, and from then on every production deploy
// fails with it. In October 2026 the guest demo's season totals test was
// set to break on 17 November 2026 this way.
//
// The fix for a test this flags is to freeze its clock, for example:
//   vi.useFakeTimers({ toFake: ['Date'] });
//   vi.setSystemTime(new Date('2026-10-16T12:00:00.000Z'));
// (inside vi.hoisted when the module under test reads the date as it
// loads; see src/lib/__tests__/guestBreederDemo.test.js).
//
// Usage: node scripts/test-clock-drift.mjs [vitest filters...]
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const shim = pathToFileURL(resolve(here, 'test-clock-drift-shim.mjs')).href;
const vitest = resolve(root, 'node_modules/.bin/vitest');
const filters = process.argv.slice(2);

const SHIFTS = [
  { days: 400, label: '400 days ahead' },
  { days: -400, label: '400 days back' },
];

let failed = false;
for (const { days, label } of SHIFTS) {
  console.log(`\nUnit tests with the clock ${label}`);
  const result = spawnSync(
    vitest,
    // Forked workers inherit NODE_OPTIONS, so the shim loads in each one.
    ['run', '--pool=forks', ...filters],
    {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        TZ: 'UTC',
        CLOCK_SHIFT_DAYS: String(days),
        NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --import ${shim}`.trim(),
      },
    },
  );
  if (result.status !== 0) {
    failed = true;
    console.error(
      `\nSome tests fail with the clock ${label}. They depend on today's date; freeze their clock (see the note at the top of scripts/test-clock-drift.mjs).`,
    );
  }
}

process.exit(failed ? 1 : 0);
