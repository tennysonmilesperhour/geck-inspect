import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const robots = readFileSync(resolve(ROOT, 'public/robots.txt'), 'utf8');

/** Groups as a crawler reads them: consecutive User-agent lines, then rules. */
function groups(text) {
  const out = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (/^user-agent$/i.test(key)) {
      if (!lastWasAgent) {
        current = { agents: [], rules: [] };
        out.push(current);
      }
      current.agents.push(value);
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && !/^sitemap$/i.test(key)) current.rules.push(`${key.trim()}: ${value}`);
    }
  }
  return out;
}

describe('robots.txt', () => {
  // A crawler obeys only the most specific group that names it, so the
  // named AI group must carry every rule of the "*" group itself
  // (adversarial review, section 11).
  it('gives the named AI crawler group the same rules and content signal as everyone else', () => {
    const all = groups(robots);
    const star = all.find((g) => g.agents.includes('*'));
    const ai = all.find((g) => g.agents.includes('GPTBot'));
    expect(star && ai).toBeTruthy();
    expect([...ai.rules].sort()).toEqual([...star.rules].sort());
    expect(ai.rules.some((r) => r.startsWith('Content-Signal:'))).toBe(true);
    expect(ai.rules).toContain('Disallow: /AdminPanel');
  });
});
