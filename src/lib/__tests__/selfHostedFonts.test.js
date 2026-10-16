import { readFileSync, existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Comments may mention where the fonts used to come from; only rules count.
const html = readFileSync('index.html', 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const css = readFileSync('src/styles/fonts.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('self-hosted fonts', () => {
  it('no longer loads fonts from Google', () => {
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    expect(css).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });

  it('declares each family once, with swap, from a file that ships in public/', () => {
    const faces = css.match(/@font-face\s*{[^}]*}/g) || [];
    expect(faces.map((f) => /font-family:\s*'([^']+)'/.exec(f)[1]).sort()).toEqual(['Inter', 'Montserrat', 'Righteous']);
    for (const face of faces) {
      expect(face).toMatch(/font-display:\s*swap/);
      const url = /url\('([^']+)'\)/.exec(face)[1];
      expect(existsSync(`public${url}`)).toBe(true);
      expect(statSync(`public${url}`).size).toBeLessThan(60 * 1024);
    }
  });

  it('preloads only files that exist, and the same files the CSS uses', () => {
    const preloads = [...html.matchAll(/'(\/fonts\/[^']+\.woff2)'/g)].map((m) => m[1]);
    expect(preloads.length).toBe(2);
    for (const href of preloads) {
      expect(existsSync(`public${href}`)).toBe(true);
      expect(css).toContain(href);
    }
  });
});
