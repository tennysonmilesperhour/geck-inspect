import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TIER_LIMITS } from '@/lib/tierLimits';

// Free went from one Morph ID ever to one a month in the October 2026
// release (plan item E2 17). Copy that still says "your first one is
// free" tells a member who has used it that Morph ID is closed to them,
// and tells a visitor the wrong offer. This walks the app's source and
// the edge functions (the lifecycle emails' words live in
// supabase/functions/_shared/lifecycle-copy.ts), so a stale line anywhere
// (landing page, Morph Guide, onboarding, the demo tour, an email) fails.
const SRC = fileURLToPath(new URL('../../', import.meta.url));
const FUNCTIONS = fileURLToPath(new URL('../../../supabase/functions/', import.meta.url));
const ROOTS = [SRC, FUNCTIONS];
const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const STALE = /first (?:one|check|AI Morph ID|Morph ID|identification)(?: is)? (?:is )?free|first (?:AI )?Morph ID free|first (?:free )?(?:Morph ID|identification|scan) (?:is )?(?:on us|free)|one (?:free )?(?:Morph ID|identification|scan) ever\b|(?:Morph ID|identification|scan)s? (?:is |are )?free once/i;

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      out.push(...sourceFiles(path));
    } else if (/\.(?:jsx?|tsx?)$/.test(name) && !/\.test\./.test(name)) {
      out.push(path);
    }
  }
  return out;
}

describe('Morph ID free offer copy', () => {
  it('Free still gets one a month', () => {
    expect(TIER_LIMITS.free.monthlyMorphIDCredits).toBe(1);
  });

  it('scans the app and the edge functions, lifecycle emails included', () => {
    const files = ROOTS.flatMap(sourceFiles).map((file) => file.slice(REPO.length));
    expect(files).toContain('src/pages/Recognition.jsx');
    expect(files).toContain('supabase/functions/_shared/lifecycle-copy.ts');
  });

  it('the pattern catches the old wording', () => {
    for (const line of [
      'Your first Morph ID is free.',
      'Try it: your first identification is free',
      'Free members get one Morph ID ever.',
      'Your first scan is on us.',
    ]) expect(line).toMatch(STALE);
    expect('Free members get one identification a month.').not.toMatch(STALE);
    expect('One free identification every month').not.toMatch(STALE);
  });

  it('no screen or email says only the first identification is free', () => {
    const stale = ROOTS.flatMap(sourceFiles)
      .flatMap((file) => readFileSync(file, 'utf8').split('\n').map((line, i) => ({ file, line: i + 1, text: line })))
      .filter(({ text }) => STALE.test(text))
      .map(({ file, line, text }) => `${file.slice(REPO.length)}:${line}: ${text.trim()}`);
    expect(stale).toEqual([]);
  });
});
