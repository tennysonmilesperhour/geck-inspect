import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TIER_LIMITS } from '@/lib/tierLimits';

// Free went from one Morph ID ever to one a month on 16 Oct 2026 (plan
// item E2 17). Copy that still says "your first one is free" tells a
// member who has used it that Morph ID is closed to them, and tells a
// visitor the wrong offer. This walks the app's source so a stale line
// anywhere (landing page, Morph Guide, onboarding, the demo tour) fails.
const SRC = fileURLToPath(new URL('../../', import.meta.url));
const STALE = /first (?:one|check|AI Morph ID|Morph ID|identification)(?: is)? (?:is )?free|first (?:AI )?Morph ID free/i;

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

  it('no screen says only the first identification is free', () => {
    const stale = sourceFiles(SRC)
      .flatMap((file) => readFileSync(file, 'utf8').split('\n').map((line, i) => ({ file, line: i + 1, text: line })))
      .filter(({ text }) => STALE.test(text))
      .map(({ file, line, text }) => `${file.slice(SRC.length)}:${line}: ${text.trim()}`);
    expect(stale).toEqual([]);
  });
});
