#!/usr/bin/env node
/**
 * Generates the static PDF assets that:
 *   - Power the "Download PDF" buttons in /CareGuide and /GeneticsGuide
 *   - Get linked from the email-capture lead-magnet on the homepage
 *
 * Run with:
 *   node scripts/generate-pdfs.mjs
 *
 * Outputs:
 *   public/downloads/geck-inspect-care-guide.pdf
 *   public/downloads/geck-inspect-genetics-guide.pdf
 *
 * The PDFs are programmatic (jsPDF text + simple layout) rather than
 * rendered from HTML ,  that keeps them small, searchable, and fully
 * deterministic across runs. Re-run this script whenever the source
 * data in src/data/care-guide.js or src/data/genetics-glossary.js
 * changes; the resulting PDFs are committed as static assets.
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { jsPDF } from "jspdf";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "downloads");
mkdirSync(OUT_DIR, { recursive: true });

// ─────────────────────────────────────────────────────────────────
// Layout primitives
// ─────────────────────────────────────────────────────────────────

const PAGE = { width: 612, height: 792, margin: 56 };
const COLORS = {
  body: "#0f1411",
  muted: "#52645a",
  accent: "#0d7c5a",
  rule: "#cfe5d9",
  bg: "#f5fbf7",
};

function newDoc() {
  return new jsPDF({
    unit: "pt",
    format: [PAGE.width, PAGE.height],
    compress: true,
  });
}

class Layout {
  constructor(doc, { title, subtitle, date }) {
    this.doc = doc;
    this.y = PAGE.margin;
    this.pageNumber = 1;
    this.headerTitle = title;
    this.headerSubtitle = subtitle;
    this.headerDate = date;
    this.drawHeader();
  }

  drawHeader() {
    const { doc } = this;
    doc.setFillColor(COLORS.bg);
    doc.rect(0, 0, PAGE.width, 36, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(COLORS.accent);
    doc.text("GECK INSPECT", PAGE.margin, 22);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.muted);
    doc.text(this.headerSubtitle || "", PAGE.width - PAGE.margin, 22, { align: "right" });
    doc.setDrawColor(COLORS.rule);
    doc.setLineWidth(0.5);
    doc.line(PAGE.margin, 36, PAGE.width - PAGE.margin, 36);
    this.y = 56;
  }

  drawFooter() {
    const { doc } = this;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(COLORS.muted);
    doc.text(
      `${this.headerTitle} · geckinspect.com`,
      PAGE.margin,
      PAGE.height - 24
    );
    doc.text(
      `Page ${this.pageNumber}`,
      PAGE.width - PAGE.margin,
      PAGE.height - 24,
      { align: "right" }
    );
  }

  ensureRoom(needed) {
    if (this.y + needed > PAGE.height - 48) {
      this.drawFooter();
      this.doc.addPage();
      this.pageNumber += 1;
      this.y = PAGE.margin;
      this.drawHeader();
    }
  }

  spacer(h = 8) {
    this.y += h;
  }

  rule() {
    this.ensureRoom(12);
    this.doc.setDrawColor(COLORS.rule);
    this.doc.setLineWidth(0.5);
    this.doc.line(PAGE.margin, this.y, PAGE.width - PAGE.margin, this.y);
    this.y += 10;
  }

  // Big cover title (used once at top of doc).
  title(text) {
    this.ensureRoom(64);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(28);
    this.doc.setTextColor(COLORS.body);
    this.wrappedText(text, { fontSize: 28, lineHeight: 32 });
    this.spacer(2);
  }

  subtitle(text) {
    this.ensureRoom(28);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(13);
    this.doc.setTextColor(COLORS.muted);
    this.wrappedText(text, { fontSize: 13, lineHeight: 17 });
    this.spacer(8);
  }

  // Section heading ,  categories / chapters.
  h2(text) {
    this.spacer(14);
    this.ensureRoom(32);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(18);
    this.doc.setTextColor(COLORS.accent);
    this.wrappedText(text, { fontSize: 18, lineHeight: 22 });
    this.spacer(2);
    this.rule();
  }

  // Sub-section heading.
  h3(text) {
    this.spacer(8);
    this.ensureRoom(22);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(13);
    this.doc.setTextColor(COLORS.body);
    this.wrappedText(text, { fontSize: 13, lineHeight: 16 });
    this.spacer(2);
  }

  paragraph(text) {
    this.ensureRoom(18);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10.5);
    this.doc.setTextColor(COLORS.body);
    this.wrappedText(text, { fontSize: 10.5, lineHeight: 14 });
    this.spacer(4);
  }

  bullet(text) {
    this.ensureRoom(16);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10.5);
    this.doc.setTextColor(COLORS.body);
    const indent = 12;
    this.doc.text("•", PAGE.margin + 2, this.y + 10);
    this.wrappedText(text, {
      x: PAGE.margin + indent,
      width: PAGE.width - PAGE.margin * 2 - indent,
      fontSize: 10.5,
      lineHeight: 14,
    });
    this.spacer(2);
  }

  callout({ tone = "info", title, items = [] }) {
    const top = this.y;
    const pad = 10;
    const indent = PAGE.margin + pad;
    const innerWidth = PAGE.width - PAGE.margin * 2 - pad * 2;

    // Pre-measure required height so we can break before drawing.
    const estLines =
      (title ? 1 : 0) +
      items.reduce((a, t) => a + Math.max(1, Math.ceil(t.length / 90)), 0);
    const estHeight = pad * 2 + estLines * 14 + 8;
    this.ensureRoom(estHeight);

    const startY = this.y;
    const tones = {
      info: { bg: "#e7f4ee", border: "#bcdcc9" },
      warn: { bg: "#fff5e0", border: "#f0d8a3" },
      success: { bg: "#e3f8ec", border: "#b8e8c5" },
      danger: { bg: "#fde7ea", border: "#f0b8c0" },
    };
    const t = tones[tone] || tones.info;

    // Reserve box; we'll draw it after the text so the height is exact.
    const boxX = PAGE.margin;
    const boxW = PAGE.width - PAGE.margin * 2;
    let cursor = startY + pad;

    if (title) {
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(11);
      this.doc.setTextColor(COLORS.body);
      const lines = this.doc.splitTextToSize(title, innerWidth);
      lines.forEach((l, i) => this.doc.text(l, indent, cursor + 11 + i * 14));
      cursor += 14 * lines.length + 4;
    }
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10);
    this.doc.setTextColor(COLORS.body);
    items.forEach((it) => {
      const lines = this.doc.splitTextToSize(`• ${it}`, innerWidth);
      lines.forEach((l, i) => this.doc.text(l, indent, cursor + 11 + i * 13));
      cursor += 13 * lines.length + 2;
    });

    const finalH = cursor - startY + pad;
    this.doc.setFillColor(t.bg);
    this.doc.setDrawColor(t.border);
    this.doc.setLineWidth(0.5);
    this.doc.roundedRect(boxX, startY, boxW, finalH, 4, 4, "FD");

    // Re-draw the text on top of the now-painted background.
    cursor = startY + pad;
    if (title) {
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(11);
      this.doc.setTextColor(COLORS.body);
      const lines = this.doc.splitTextToSize(title, innerWidth);
      lines.forEach((l, i) => this.doc.text(l, indent, cursor + 11 + i * 14));
      cursor += 14 * lines.length + 4;
    }
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10);
    this.doc.setTextColor(COLORS.body);
    items.forEach((it) => {
      const lines = this.doc.splitTextToSize(`• ${it}`, innerWidth);
      lines.forEach((l, i) => this.doc.text(l, indent, cursor + 11 + i * 13));
      cursor += 13 * lines.length + 2;
    });
    this.y = startY + finalH + 6;
  }

  kv({ items }) {
    items.forEach((it) => {
      this.ensureRoom(16);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(10);
      this.doc.setTextColor(COLORS.body);
      const labelW = 130;
      this.doc.text(String(it.label || ""), PAGE.margin, this.y + 10);
      this.doc.setFont("helvetica", "normal");
      const value = String(it.value || "");
      const lines = this.doc.splitTextToSize(
        value,
        PAGE.width - PAGE.margin * 2 - labelW
      );
      lines.forEach((l, i) =>
        this.doc.text(l, PAGE.margin + labelW, this.y + 10 + i * 13)
      );
      this.y += Math.max(14, 14 * lines.length + 2);
    });
    this.spacer(4);
  }

  table({ headers, rows, caption }) {
    const cols = headers.length;
    const innerW = PAGE.width - PAGE.margin * 2;
    const colW = innerW / cols;

    this.ensureRoom(28);
    this.doc.setFillColor(COLORS.bg);
    this.doc.rect(PAGE.margin, this.y, innerW, 20, "F");
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(COLORS.body);
    headers.forEach((h, i) => {
      this.doc.text(String(h || ""), PAGE.margin + 6 + i * colW, this.y + 13);
    });
    this.y += 20;

    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10);
    this.doc.setDrawColor(COLORS.rule);
    rows.forEach((row) => {
      // Each cell may wrap; row height is the max of its cell heights.
      const cellLines = row.map((cell) =>
        this.doc.splitTextToSize(String(cell || ""), colW - 10)
      );
      const rowH = Math.max(...cellLines.map((l) => l.length * 13)) + 6;
      this.ensureRoom(rowH);
      cellLines.forEach((lines, i) => {
        lines.forEach((l, j) =>
          this.doc.text(l, PAGE.margin + 6 + i * colW, this.y + 12 + j * 13)
        );
      });
      this.doc.line(
        PAGE.margin,
        this.y + rowH,
        PAGE.width - PAGE.margin,
        this.y + rowH
      );
      this.y += rowH;
    });

    if (caption) {
      this.spacer(2);
      this.doc.setFont("helvetica", "italic");
      this.doc.setFontSize(9);
      this.doc.setTextColor(COLORS.muted);
      this.wrappedText(caption, { fontSize: 9, lineHeight: 12 });
    }
    this.spacer(6);
  }

  // Renders text wrapped to the content column. Advances this.y past
  // the text. Honors page-break by recursing per-line.
  wrappedText(text, opts = {}) {
    const {
      x = PAGE.margin,
      width = PAGE.width - PAGE.margin * 2,
      fontSize = 10.5,
      lineHeight = 14,
    } = opts;
    this.doc.setFontSize(fontSize);
    const lines = this.doc.splitTextToSize(String(text || ""), width);
    for (const line of lines) {
      this.ensureRoom(lineHeight);
      this.doc.text(line, x, this.y + lineHeight - 3);
      this.y += lineHeight;
    }
  }

  finalize() {
    this.drawFooter();
  }
}

function renderBody(layout, body) {
  for (const block of body || []) {
    switch (block.type) {
      case "p":
        layout.paragraph(block.text);
        break;
      case "ul":
      case "ol":
        for (const it of block.items || []) layout.bullet(it);
        layout.spacer(2);
        break;
      case "dl":
        for (const it of block.items || [])
          layout.paragraph(`${it.term}: ${it.def}`);
        break;
      case "callout":
        layout.callout({
          tone: block.tone || "info",
          title: block.title,
          items: block.items || [],
        });
        break;
      case "kv":
        layout.kv({ items: block.items || [] });
        break;
      case "table":
        layout.table({
          headers: block.headers,
          rows: block.rows,
          caption: block.caption,
        });
        break;
      default:
        // Unknown block ,  skip silently to keep PDFs clean.
        break;
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Care Guide PDF
// ─────────────────────────────────────────────────────────────────

async function renderCareGuide() {
  const { CARE_CATEGORIES } = await import(
    "../src/data/care-guide.js"
  );

  const doc = newDoc();
  const today = new Date();
  const date = today.toISOString().slice(0, 10);
  const layout = new Layout(doc, {
    title: "Crested Gecko Care Guide",
    subtitle: "Care Guide",
    date,
  });

  layout.title("Crested Gecko Care Guide");
  layout.subtitle(
    "A complete husbandry reference for Correlophus ciliatus ,  beginner-friendly, detailed enough for working breeders. Compiled by Geck Inspect."
  );
  layout.paragraph(
    "Generated " + date + " · geckinspect.com/CareGuide · Free to download and share. Always check the live online edition for the latest corrections."
  );
  layout.spacer(8);

  // Table of contents
  layout.h2("Contents");
  for (const cat of CARE_CATEGORIES) {
    layout.bullet(`${cat.label} ,  ${cat.tagline || ""}`);
  }
  layout.spacer(8);

  for (const cat of CARE_CATEGORIES) {
    layout.h2(cat.label);
    if (cat.tagline) layout.subtitle(cat.tagline);
    if (Array.isArray(cat.quickFacts) && cat.quickFacts.length) {
      layout.kv({ items: cat.quickFacts });
    }
    for (const sec of cat.sections || []) {
      layout.h3(sec.title);
      renderBody(layout, sec.body);
    }
  }

  layout.spacer(20);
  layout.rule();
  layout.paragraph(
    "© Geck Inspect. Built by a crested gecko breeder, for crested gecko breeders. Get the always-current version, AI morph identification, lineage trees, and the genetics calculator at geckinspect.com ,  every core feature is free."
  );

  layout.finalize();
  return Buffer.from(doc.output("arraybuffer"));
}

// ─────────────────────────────────────────────────────────────────
// Genetics Guide PDF
// ─────────────────────────────────────────────────────────────────

async function renderGeneticsGuide() {
  // We import the plain-data glossary directly. The full SECTIONS
  // array in genetics-sections.jsx contains React/JSX bodies that
  // can't be evaluated outside the React renderer, so we stick to
  // the glossary + a curated PDF-only "core concepts" prose section
  // hard-coded here. The in-app Genetics Guide remains the rich
  // interactive version ,  this PDF is the portable reference.
  const glossaryModule = await import(
    "../src/data/genetics-glossary.js"
  );
  const GLOSSARY_GROUPS = glossaryModule.GLOSSARY_GROUPS;

  const doc = newDoc();
  const today = new Date();
  const date = today.toISOString().slice(0, 10);
  const layout = new Layout(doc, {
    title: "Crested Gecko Genetics Guide",
    subtitle: "Genetics Guide",
    date,
  });

  layout.title("Crested Gecko Genetics");
  layout.subtitle(
    "A working breeder's reference: how inheritance, morphs, and trait projection actually work in Correlophus ciliatus. Compiled by Geck Inspect."
  );
  layout.paragraph(
    "Generated " + date + " · geckinspect.com/GeneticsGuide · Free to download and share. Pair this with the in-app genetics calculator for live punnett projections."
  );
  layout.spacer(8);

  // ── Foundations
  layout.h2("Foundations");
  layout.h3("What a gene is");
  layout.paragraph(
    "A gene is a segment of DNA that carries instructions for a trait ,  melanin production, scale shape, pattern layout, eye color. Each gecko inherits two copies of every gene, one from the sire and one from the dam. These two copies are called alleles."
  );
  layout.h3("Alleles, homozygous, heterozygous");
  layout.bullet(
    "Homozygous (AA or aa): both alleles at a gene are identical. The animal has two of the same thing."
  );
  layout.bullet(
    "Heterozygous (Aa): the two alleles are different. The animal carries two distinct versions of the gene."
  );
  layout.bullet(
    "Genotype = the actual code; phenotype = what you see. Two geckos can share a phenotype with very different genotypes."
  );

  layout.h3("Dominant, recessive, incomplete dominant");
  layout.bullet(
    "Dominant: a single copy is enough to show the trait. Rare in proven crested gecko morphs."
  );
  layout.bullet(
    "Recessive: the trait only shows when both copies are the recessive allele. Axanthic is the cleanest crested gecko example."
  );
  layout.bullet(
    "Incomplete dominant: one copy produces the visual form; two produce a more extreme \"super.\" Most proven crested gecko morphs work this way ,  Lilly White, Cappuccino, Soft Scale, White Wall."
  );
  layout.callout({
    tone: "warn",
    title: "Visual het identification is never reliable",
    items: [
      "You cannot tell from photos whether a gecko carries a recessive trait. Lineage and progeny testing are the only proofs.",
      "\"66% possible het\" means the offspring of het × het that LOOK normal ,  statistically 2 of 3 carry the gene, but no individual animal can be confirmed without a test pair.",
    ],
  });

  // ── Punnetts
  layout.h2("Punnett Projections");
  layout.h3("Single-gene crosses");
  layout.paragraph(
    "Every parent contributes one of its two alleles at random. Two parents × two alleles each = four possible offspring genotypes per gene."
  );
  layout.kv({
    items: [
      { label: "AA × aa", value: "100% Aa (heterozygous)" },
      { label: "Aa × Aa", value: "25% AA, 50% Aa, 25% aa" },
      { label: "Aa × aa", value: "50% Aa, 50% aa" },
      { label: "aa × aa", value: "100% aa" },
    ],
  });
  layout.h3("Multi-gene crosses");
  layout.paragraph(
    "Each gene is independent (no linkage observed in any proven crested gecko morph). Multiply the per-gene odds ,  Lilly × Lilly Het Axanthic gives 25% supers × 50% het = 12.5% super Lilly het Axanthic, and so on."
  );
  layout.callout({
    tone: "info",
    title: "Use the live calculator",
    items: [
      "geckinspect.com/calculator ,  multi-trait projection across every proven crested gecko morph.",
      "Per-morph deep-dives at geckinspect.com/calculator/<morph>: lilly-white, cappuccino, axanthic, phantom, hypo, whiteout, empty-back, soft-scale.",
    ],
  });

  // ── Polygenic
  layout.h2("Polygenic Traits");
  layout.paragraph(
    "Many of the visible features that breeders care about most ,  base color, harlequin pattern coverage, flame markings, dalmatian spot density ,  are controlled by many genes acting additively. They cannot be Punnett-squared, only selected for over generations."
  );
  layout.bullet(
    "Outcomes are continuous and skew toward the parents' average rather than producing discrete categories."
  );
  layout.bullet(
    "A single \"high-end\" pairing can still produce mediocre offspring ,  and breeders selecting from many clutches over years are why the hobby's average gecko is so much better-looking than 20 years ago."
  );
  layout.bullet(
    "Selective pressure works. Tracking exact weights, photos, and pairings gives you data to keep the right animals across generations."
  );

  // ── Lethal Allele
  layout.h2("Lethal Alleles");
  layout.paragraph(
    "An incomplete dominant allele can be lethal in homozygous form ,  animals inheriting two copies fail to develop or die early. Lilly White is the textbook example in crested geckos: super-Lillys (homozygous LW) are lethal. The practical implication: never pair Lilly × Lilly. The expected ratio is 25% super (lethal), 50% Lilly, 25% normal ,  you lose a quarter of the clutch and the visual gain over Lilly × non-Lilly is zero."
  );

  // ── Glossary
  layout.h2("Glossary");
  for (const group of GLOSSARY_GROUPS) {
    layout.h3(group.category);
    for (const entry of group.entries) {
      layout.paragraph(`${entry.term}: ${entry.def}`);
    }
  }

  layout.spacer(20);
  layout.rule();
  layout.paragraph(
    "© Geck Inspect. The interactive Genetics Guide at geckinspect.com/GeneticsGuide includes diagrams, live punnett squares, and the per-morph calculator. Get every core feature free."
  );

  layout.finalize();
  return Buffer.from(doc.output("arraybuffer"));
}

// ─────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────

async function main() {
  const carePath = join(OUT_DIR, "geck-inspect-care-guide.pdf");
  const geneticsPath = join(OUT_DIR, "geck-inspect-genetics-guide.pdf");

  console.log("→ rendering Care Guide…");
  const careBytes = await renderCareGuide();
  writeFileSync(carePath, careBytes);
  console.log(`  ✓ ${carePath} (${(careBytes.length / 1024).toFixed(1)} KB)`);

  console.log("→ rendering Genetics Guide…");
  const geneticsBytes = await renderGeneticsGuide();
  writeFileSync(geneticsPath, geneticsBytes);
  console.log(
    `  ✓ ${geneticsPath} (${(geneticsBytes.length / 1024).toFixed(1)} KB)`
  );
}

main().catch((err) => {
  console.error("PDF generation failed:", err);
  process.exit(1);
});
