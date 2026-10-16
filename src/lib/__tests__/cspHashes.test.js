import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cspHash, inlineScripts, inlineScriptSources } from '../../../scripts/csp-inline.mjs';
import { scriptSrcOf } from '../../../scripts/check-csp-hashes.mjs';

// Review item E3 31: the Content Security Policy allows the inline scripts
// of index.html by hash instead of 'unsafe-inline'. vercel.json is
// generated (scripts/build-vercel-json.mjs) and committed; Vercel reads the
// committed copy, so a changed inline script with a stale vercel.json would
// be blocked in every browser. This fails first.
const INDEX_HTML = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
const VERCEL = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8'));
const scriptSrc = scriptSrcOf(VERCEL);

describe('script-src in vercel.json', () => {
  it("does not allow 'unsafe-inline' or eval", () => {
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('lists exactly the hashes of the inline scripts in index.html (run node scripts/build-vercel-json.mjs if not)', () => {
    const listed = scriptSrc.filter((s) => s.startsWith("'sha256-") || s === "'unsafe-hashes'");
    expect(listed).toEqual(inlineScriptSources(INDEX_HTML));
    expect(inlineScripts(INDEX_HTML).scripts.length).toBeGreaterThan(0);
  });

  it('keeps the script origins the app loads from', () => {
    for (const origin of ["'self'", 'https://www.googletagmanager.com', 'https://us-assets.i.posthog.com', 'https://js.stripe.com']) {
      expect(scriptSrc).toContain(origin);
    }
  });
});

describe('inline script hashing', () => {
  it('hashes executable inline scripts only, byte for byte', () => {
    const html = `<!doctype html><head>
      <!-- <script>commented()</script> -->
      <script>run(1)</script>
      <script type="module">run(2)</script>
      <script type="application/ld+json">{"@type":"Organization"}</script>
      <script type="module" src="/src/main.jsx"></script>
      <script async src="https://example.com/x.js"></script>
    </head>`;
    const { scripts, handlers } = inlineScripts(html);
    expect(scripts.map((s) => s.text)).toEqual(['run(1)', 'run(2)']);
    expect(scripts[0].hash).toBe(cspHash('run(1)'));
    expect(handlers).toEqual([]);
    // A single changed character is a different hash.
    expect(cspHash('run(1)')).not.toBe(cspHash('run(1) '));
  });

  it("matches a known SHA-256 value (the format browsers compare)", () => {
    // printf 'alert(1)' | openssl dgst -sha256 -binary | base64
    expect(cspHash('alert(1)')).toBe("'sha256-bhHHL3z2vDgxUt0W3dWQOrprscmda2Y5pLsLg4GF+pI='");
  });

  it("allows an inline event handler only together with 'unsafe-hashes'", () => {
    const html = `<link rel="stylesheet" href="/a.css" media="print" onload="this.media='all'">`;
    const { handlers } = inlineScripts(html);
    expect(handlers.map((h) => h.text)).toEqual(["this.media='all'"]);
    expect(inlineScriptSources(html)).toEqual(["'unsafe-hashes'", cspHash("this.media='all'")]);
  });

  it('refuses a javascript: URL, which no hash can allow', () => {
    expect(() => inlineScripts('<a href="javascript:void(0)">x</a>')).toThrow(/javascript: URL/);
  });
});

describe('llms-full.txt', () => {
  it('is kept out of search results, after the site-wide robots header', () => {
    const blocks = VERCEL.headers;
    const siteWide = blocks.findIndex((b) => b.source === '/(.*)');
    const full = blocks.findIndex((b) => b.source === '/llms-full.txt');
    expect(full).toBeGreaterThan(siteWide);
    expect(blocks[full].headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex' });
  });
});
