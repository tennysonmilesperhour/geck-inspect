import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import colors from 'tailwindcss/colors';

// The rose "New" badge on the Morph Guide index is 12 px bold white text.
// On rose-500 that was 3.67 to 1, under the 4.5 to 1 WCAG AA asks of text
// that size; rose-700 passes.

const HERE = fileURLToPath(new URL('.', import.meta.url));
const read = (file) => readFileSync(resolve(HERE, '..', file), 'utf8');

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('Morph Guide "New" badge', () => {
  it('uses a rose dark enough for white 12 px text', () => {
    expect(contrast(colors.rose[500], '#ffffff')).toBeLessThan(4.5);
    expect(contrast(colors.rose[700], '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('is rose-700 on the index card and in the spotlight', () => {
    const card = read('MorphIndexCard.jsx');
    const spotlight = read('MorphIndexSpotlight.jsx');
    expect(card).toMatch(/bg-rose-700[^"]*text-white[^"]*">\s*New\s*</);
    expect(spotlight).toContain("badge === 'New' ? 'bg-rose-700 text-white'");
    for (const source of [card, spotlight]) expect(source).not.toMatch(/bg-rose-500[^'"]*text-white|text-white[^'"]*bg-rose-500/);
  });
});
