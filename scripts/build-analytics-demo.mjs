#!/usr/bin/env node
/**
 * Build the Market Analytics design demo as a single HTML file.
 *
 *   node scripts/build-analytics-demo.mjs [outFile]
 *
 * Runs Vite on demo/market-analytics, then inlines the JS and CSS so the
 * page works with no server (it is published as a private Artifact for
 * design review). The output is a page fragment (title, style, markup,
 * script) because the Artifact host supplies the <html>/<head>/<body>.
 *
 * The app themes itself with :root[data-theme="..."] selectors, but the
 * Artifact viewer writes its own data-theme ("light"/"dark") on <html>.
 * So the default Blizzard theme and accent blocks are rewritten to plain
 * :root selectors and always apply.
 */

import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demoDir = path.join(root, 'demo/market-analytics');
const distDir = path.join(demoDir, 'dist');
const outFile = path.resolve(process.argv[2] || path.join(distDir, 'market-analytics-demo.html'));

await build({ configFile: path.join(demoDir, 'vite.config.js'), logLevel: 'warn' });

const assets = fs.readdirSync(path.join(distDir, 'assets'));
const js = assets.filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(distDir, 'assets', f), 'utf8')).join('\n');
let css = assets.filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(path.join(distDir, 'assets', f), 'utf8')).join('\n');

css = css
  .replaceAll(':root[data-theme=blizzard]', ':root:root')
  .replaceAll(':root[data-theme="blizzard"]', ':root:root')
  .replaceAll(':root[data-secondary=blizzard]', ':root:root')
  .replaceAll(':root[data-secondary="blizzard"]', ':root:root');

const safeJs = js.replaceAll('</script', '<\\/script');
const safeCss = css.replaceAll('</style', '<\\/style');

const page = `<title>Market Analytics Redesign</title>
<style>
:root { color-scheme: dark; }
html, body { background: hsl(218 32% 5%); color: hsl(0 0% 96%); }
#root { width: 100%; }
${safeCss}
</style>
<script>document.documentElement.classList.add('dark');</script>
<div id="root"></div>
<script type="module">
${safeJs}
</script>
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, page);
console.log(`Wrote ${path.relative(root, outFile)} (${(page.length / 1024).toFixed(0)} KB)`);
