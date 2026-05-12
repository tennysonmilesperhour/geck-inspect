#!/usr/bin/env node
/**
 * Generate GEO-follow-up.pdf ,  the punch list of post-audit items
 * that require user (founder / editorial team) action and can't be
 * fixed in code alone.
 *
 * Reads structured content from the `SECTIONS` constant below and
 * lays it out onto a multi-page A4 PDF using jspdf (already a dep
 * for the pedigree/worksheet print flows ,  no new packages added).
 *
 * Usage:
 *   node scripts/build-geo-followup-pdf.mjs
 *
 * Output:
 *   ./GEO-follow-up.pdf   (repo root, gitignored by default)
 *
 * Keep the PDF content in sync with docs/seo.md's "When the audit
 * comes back" section ,  same items, different presentation.
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const { jsPDF } = require('jspdf');

const OUT = resolve(REPO_ROOT, 'GEO-follow-up.pdf');

// ── content ────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    kind: 'cover',
    title: 'Geck Inspect ,  GEO Follow-Up',
    subtitle: 'What the 2026-04-17 audit flagged, what we shipped, and what still needs you.',
    date: '2026-04-17',
  },
  {
    kind: 'h1',
    text: 'Score trajectory',
  },
  {
    kind: 'p',
    text:
      'Baseline audit (pre-fix): 33/100. Post-fix audit (partially observed the new architecture): 49/100. ' +
      'Projected after the items in this document are completed: ~78/100. ' +
      'The remaining gap is almost entirely brand authority (external presence on Wikipedia, ' +
      'Reddit, YouTube, LinkedIn, MorphMarket) ,  which can only be earned, not shipped.',
  },
  {
    kind: 'h1',
    text: 'Already shipped (code)',
  },
  {
    kind: 'bullets',
    items: [
      'Per-route prerendered HTML (88 routes). Non-JS crawlers now get real titles, descriptions, canonicals, OG/Twitter tags, and a <noscript> body ,  not the byte-identical SPA shell.',
      'Per-route self-referential canonicals.',
      'About, Contact, Terms, MarketplaceVerification pages (all public, all with JSON-LD).',
      'CareGuide, GeneticsGuide, GeneticCalculatorTool moved public; CareGuide topic deep-links at /CareGuide/<topic> (34 URLs).',
      'Morph taxonomy hubs at /MorphGuide/category/<id> and /MorphGuide/inheritance/<id> (11 URLs).',
      'Sitemap with <lastmod> per URL (98 URLs, auto-generated).',
      'Security headers in vercel.json (HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP, X-Robots-Tag).',
      'Clean /Breeder/<slug> path (legacy ?slug= 301 redirects).',
      'BreadcrumbList schema on every inner page.',
      'FAQPage JSON-LD + visible FAQ section on every MorphGuide/<slug>.',
      'Article + DefinedTerm + speakable schema across guides.',
      'Author + reviewedBy + datePublished + dateModified on every content page.',
      'llms-full.txt (71 KB complete corpus).',
      'IndexNow key file (ready to push update notifications to Bing/Yandex).',
      'Open /morphs.csv dataset with CORS enabled.',
      'Client-side noindex on 404 (PageNotFound) + static 404.html.',
    ],
  },
  {
    kind: 'h1',
    text: 'Your turn ,  what only you can do',
  },
  {
    kind: 'h2',
    text: 'This week',
  },
  {
    kind: 'task',
    title: '1. Populate Organization.sameAs',
    detail:
      'Edit src/lib/organization-schema.js and uncomment/fill the SAME_AS array with the real URLs: Instagram, TikTok, YouTube, LinkedIn, Reddit profile, MorphMarket store, any X/Twitter or Wikidata item once created. Five-minute edit; largest single schema lift ,  the audit called this out as the single most impactful property for AI entity recognition.',
    time: '5 min',
  },
  {
    kind: 'task',
    title: '2. Submit the sitemap to Bing Webmaster Tools',
    detail:
      'bing.com/webmasters -> Add site -> verify ownership via the meta tag or CNAME. Once verified, paste https://geckinspect.com/sitemap.xml into Sitemaps and enable IndexNow. IndexNow key is already live at geckinspect.com/c9f2d53b0ac96f2ef77485a2b5d9b280.txt. Verification meta tag goes in index.html head (send me the tag and I\'ll wire it).',
    time: '15 min',
  },
  {
    kind: 'task',
    title: '3. Create a Wikidata entity for Geck Inspect',
    detail:
      'wikidata.org -> Create a new item. Label: "Geck Inspect". Description: "Web platform for crested gecko breeders and keepers". Statements: instance of (P31) = Q1371819 (web service) or Q21980538 (application software); official website (P856) = https://geckinspect.com/; industry (P452) = reptile keeping. Cite the Base44 template catalog listing as a source if no press exists yet. Once the Qxxxx ID is assigned, add the URL to SAME_AS in organization-schema.js.',
    time: '30 min',
  },
  {
    kind: 'task',
    title: '4. Create a LinkedIn Company page',
    detail:
      'linkedin.com/company/new -> Pick "Geck Inspect" as the page name, crested gecko software as the industry. Add the logo, a 300-character about blurb, and link back to geckinspect.com. Put the LinkedIn URL into SAME_AS.',
    time: '20 min',
  },
  {
    kind: 'h2',
    text: 'This month',
  },
  {
    kind: 'task',
    title: '5. Name a real human author / reviewer',
    detail:
      'Right now the editorial byline reads "Reviewed by the Geck Inspect editorial team" ,  legit, but weaker than a named person with credentials for E-E-A-T. Pick one or two people (you, a breeder partner) and give me their name, 1-2 sentence bio, and optional headshot. I\'ll replace the Organization schema at src/lib/editorial.js with a real Person entity (jobTitle, knowsAbout, yearsOfExperience). Rankings lift is material, especially for Perplexity and Google AI Overviews.',
    time: '1 hour',
  },
  {
    kind: 'task',
    title: '6. Launch a YouTube channel with 5 starter videos',
    detail:
      'Gemini weights YouTube heavily. Starter set: (1) AI morph-ID demo, (2) Lilly White genetics explainer ,  why super form is lethal, (3) enclosure setup for a first crested gecko, (4) breeding-readiness weight/age checklist, (5) Genetic Calculator demo pairing a Harlequin het Cappuccino with an Axanthic het. Aim for 3-5 min each, scripted from the llms.txt content, filmed on a phone. Put the channel URL in SAME_AS and cross-link from relevant guides.',
    time: '1-2 days',
  },
  {
    kind: 'task',
    title: '7. Seed authentic r/CrestedGecko engagement',
    detail:
      'Not guerilla marketing ,  real, disclosed engagement. Pick 10 recent threads asking morph-ID, care, or genetics questions and answer them thoughtfully with a deep link to the relevant /MorphGuide/<slug> or /CareGuide/<topic> where appropriate. Disclose affiliation. Perplexity weights Reddit citations heavily; ChatGPT does too. Goal is 3-5 top-voted helpful posts per month on the subreddit.',
    time: '30 min / week ongoing',
  },
  {
    kind: 'task',
    title: '8. Industry press outreach',
    detail:
      'Target: MorphMarket blog, Pangea Reptile, Repashy Superfoods, ReptiFiles, Reptiles Magazine, Gecko Time. Pitch: the AI morph-ID tool + the open morphs.csv dataset + the genetics calculator = useful standalone story for their readers. Offer co-branded content where relevant. Even 2-3 outbound links from these properties shifts brand authority materially.',
    time: '2-3 hours',
  },
  {
    kind: 'task',
    title: '9. aggregateRating on SoftwareApplication',
    detail:
      'Once reviews exist (either from Trustpilot, Product Hunt, or in-app ratings), wire them into the SoftwareApplication schema at src/lib/organization-schema.js. Would prefer real reviews over fabricated ,  don\'t ship this until there\'s real data to back it.',
    time: 'deferred until reviews exist',
  },
  {
    kind: 'h2',
    text: 'Longer-term technical follow-ups',
  },
  {
    kind: 'task',
    title: '10. Real HTTP 404 status for unknown paths',
    detail:
      'Current state: the SPA catch-all rewrite sends every path to /index.html with 200 status. Unknown paths render the PageNotFound component, which sets <meta name="robots" content="noindex, nofollow"> via Helmet ,  fine for JS crawlers, imperfect for crawlers that score 200-status soft-404s negatively. To fix: enumerate every known SPA route in vercel.json (public + authenticated + programmatic), send matches to /index.html, send everything else to /404.html with status 404. Implementation path: extend scripts/seo-routes.mjs to emit a vercel.json fragment during build.',
    time: '2-3 hours of engineering',
  },
  {
    kind: 'task',
    title: '11. Code-split and bundle optimization',
    detail:
      'The main index chunk is ~1.24 MB brotli-compressed; splits per route exist but some dependencies (recharts, html2canvas, jspdf) sit in the main chunk and blow up LCP on mobile. Add manualChunks for recharts + html2canvas + jspdf in vite.config.js; preload hero image on / and /MorphGuide; consider a lighter-weight chart lib for Dashboard sparklines. Gains ~30-40 points on Mobile Lighthouse.',
    time: '4-6 hours',
  },
  {
    kind: 'task',
    title: '12. Mixed-case URL normalization',
    detail:
      'Most internal URLs are PascalCase (/MorphGuide, /CareGuide). A few live in different casings depending on external inbound links. Add vercel.json redirect rules for the common variants to canonical casing. Low priority.',
    time: '30 min',
  },
  {
    kind: 'task',
    title: '13. Seed a Wikipedia External Link',
    detail:
      'Only viable once we have at least one independent reliable-source citation of Geck Inspect (e.g., a MorphMarket blog mention, a ReptiFiles article, a Reptiles Magazine brief). Once that exists, the Correlophus ciliatus Wikipedia article\'s External Links section is the target ,  follow Wikipedia\'s WP:EL policy carefully or it gets reverted. Biggest entity-recognition lift available after Wikidata.',
    time: 'deferred until a press citation exists',
  },
  {
    kind: 'h1',
    text: 'Reference',
  },
  {
    kind: 'bullets',
    items: [
      'Architecture doc: docs/seo.md (in the repo) ,  full map of the shipped layers.',
      'Canonical social/sameAs registry: src/lib/organization-schema.js.',
      'Editorial dates + author: src/lib/editorial.js.',
      'Route manifest (add new URLs here): scripts/seo-routes.mjs.',
      'Open dataset: https://geckinspect.com/morphs.csv',
      'Full corpus for LLMs: https://geckinspect.com/llms-full.txt',
      'IndexNow key file: https://geckinspect.com/c9f2d53b0ac96f2ef77485a2b5d9b280.txt',
    ],
  },
  {
    kind: 'p',
    italic: true,
    text:
      'When social handles, Wikidata ID, or named reviewer info are ready, send them over and I\'ll wire them into organization-schema.js + editorial.js in one pass.',
  },
];

// ── layout ────────────────────────────────────────────────────────────────

const PAGE = { w: 210, h: 297 }; // A4 in mm
const MARGIN = { top: 22, bottom: 20, left: 18, right: 18 };
const CONTENT_W = PAGE.w - MARGIN.left - MARGIN.right;

// mm -> pt helper for font sizing proportional to jsPDF's default mm unit
const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

let y = MARGIN.top;
let page = 1;

function ensureRoom(needed) {
  if (y + needed > PAGE.h - MARGIN.bottom) {
    drawFooter();
    doc.addPage();
    page += 1;
    y = MARGIN.top;
  }
}

function drawFooter() {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Geck Inspect ,  GEO Follow-Up · page ${page}`, MARGIN.left, PAGE.h - 10);
  doc.text('geckinspect.com', PAGE.w - MARGIN.right, PAGE.h - 10, { align: 'right' });
  doc.setTextColor(0);
}

function writeWrapped(text, opts = {}) {
  const { font = 'helvetica', style = 'normal', size = 10, gap = 1.2, color = 20 } = opts;
  doc.setFont(font, style);
  doc.setFontSize(size);
  doc.setTextColor(color);
  const lines = doc.splitTextToSize(text, CONTENT_W);
  const lineH = (size / 2.5) * gap; // rough mm per line
  for (const line of lines) {
    ensureRoom(lineH + 1);
    doc.text(line, MARGIN.left, y);
    y += lineH;
  }
  doc.setTextColor(0);
}

function cover(section) {
  // Big title, subtitle, date, thin rule.
  doc.setFillColor(6, 78, 59); // emerald-900
  doc.rect(0, 0, PAGE.w, 60, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text(section.title, MARGIN.left, 35);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  const subLines = doc.splitTextToSize(section.subtitle, CONTENT_W);
  let sy = 45;
  for (const l of subLines) {
    doc.text(l, MARGIN.left, sy);
    sy += 5;
  }
  doc.setTextColor(0);
  y = 75;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Report date: ${section.date}`, MARGIN.left, y);
  doc.text('Source: 2026-04-17 follow-up audit + shipped architecture', MARGIN.left, y + 5);
  doc.setTextColor(0);
  y += 15;
}

function h1(text) {
  ensureRoom(14);
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(6, 78, 59);
  doc.text(text, MARGIN.left, y);
  doc.setTextColor(0);
  y += 5;
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN.left, y, MARGIN.left + CONTENT_W, y);
  y += 4;
}

function h2(text) {
  ensureRoom(9);
  y += 1;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text(text, MARGIN.left, y);
  doc.setTextColor(0);
  y += 5;
}

function paragraph(text, opts = {}) {
  writeWrapped(text, {
    size: 10,
    style: opts.italic ? 'italic' : 'normal',
    color: opts.italic ? 80 : 20,
  });
  y += 2;
}

function bullets(items) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const item of items) {
    ensureRoom(6);
    // bullet dot
    doc.setFillColor(16, 185, 129);
    doc.circle(MARGIN.left + 1.2, y - 1.4, 0.8, 'F');
    const lines = doc.splitTextToSize(item, CONTENT_W - 6);
    for (let i = 0; i < lines.length; i++) {
      ensureRoom(5);
      doc.text(lines[i], MARGIN.left + 5, y);
      y += 4.3;
    }
    y += 1;
  }
  y += 1;
}

function task({ title, detail, time }) {
  ensureRoom(18);
  // Draw time pill on its own line ABOVE the title so it never
  // collides with the detail paragraph. Helvetica's baseline model
  // meant the old inline-right pill overlapped detail text by 1-2mm
  // on short titles; moving it out of the way is the simplest fix.
  if (time) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(255);
    doc.setFillColor(16, 185, 129);
    const tw = doc.getTextWidth(time) + 4;
    doc.roundedRect(MARGIN.left, y - 3.2, tw, 4.5, 1.2, 1.2, 'F');
    doc.text(time, MARGIN.left + 2, y);
    doc.setTextColor(0);
    y += 4;
  }
  // task title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(10);
  const titleLines = doc.splitTextToSize(title, CONTENT_W);
  for (const l of titleLines) {
    ensureRoom(5);
    doc.text(l, MARGIN.left, y);
    y += 5;
  }
  y += 1;
  // detail
  writeWrapped(detail, { size: 9.5, color: 40 });
  y += 3;
}

// ── render ─────────────────────────────────────────────────────────────────

for (const section of SECTIONS) {
  switch (section.kind) {
    case 'cover':
      cover(section);
      break;
    case 'h1':
      h1(section.text);
      break;
    case 'h2':
      h2(section.text);
      break;
    case 'p':
      paragraph(section.text, section);
      break;
    case 'bullets':
      bullets(section.items);
      break;
    case 'task':
      task(section);
      break;
    default:
      throw new Error(`unknown section kind: ${section.kind}`);
  }
}

drawFooter();

doc.save(OUT);
console.log(
  `[build-geo-followup-pdf] wrote ${doc.internal.getNumberOfPages()} pages -> ${OUT}`,
);
