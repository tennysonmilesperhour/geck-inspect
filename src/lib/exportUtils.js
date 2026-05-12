import jsPDF from 'jspdf';

/**
 * Roster export utilities.
 *
 * One place to define what a "gecko row" looks like in an export, so
 * CSV and PDF stay in sync. Format:
 *
 *   exportGeckosCSV(geckos)  ,  triggers a .csv download
 *   exportGeckosPDF(geckos, { title })  ,  triggers a .pdf download
 *
 * Both walk the same column spec, so adding a new field only requires
 * updating the COLUMNS array below.
 */

const COLUMNS = [
  { key: 'name',         header: 'Name',      width: 32 },
  { key: 'gecko_id_code',header: 'ID Code',   width: 24 },
  { key: 'sex',          header: 'Sex',       width: 14 },
  { key: 'status',       header: 'Status',    width: 26 },
  { key: 'hatch_date',   header: 'Hatched',   width: 24,
    format: (v) => (v ? new Date(v).toLocaleDateString() : '') },
  { key: 'weight_grams', header: 'Weight (g)',width: 20,
    format: (v) => (v != null ? String(v) : '') },
  { key: 'morph_tags',   header: 'Morphs',    width: 50,
    format: (v) => Array.isArray(v) ? v.join(', ') : (v || '') },
  { key: 'sire_name',    header: 'Sire',      width: 32 },
  { key: 'dam_name',     header: 'Dam',       width: 32 },
  { key: 'price',        header: 'Price',     width: 18,
    format: (v) => (v != null ? String(v) : '') },
  { key: 'notes',        header: 'Notes',     width: 60,
    format: (v) => (v || '').replace(/\s+/g, ' ').slice(0, 300) },
];

function renderCell(gecko, col) {
  const raw = gecko?.[col.key];
  if (col.format) return col.format(raw) ?? '';
  return raw == null ? '' : String(raw);
}

// Escape a CSV field per RFC 4180: wrap in quotes when it contains a
// comma, quote, or newline; double any interior quotes.
function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function timestampSlug() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Generate a CSV string from an array of gecko rows and trigger a download.
 * Returns the filename that was used.
 */
export function exportGeckosCSV(geckos, { filename } = {}) {
  const header = COLUMNS.map((c) => csvEscape(c.header)).join(',');
  const rows = geckos.map((g) =>
    COLUMNS.map((c) => csvEscape(renderCell(g, c))).join(',')
  );
  // Leading BOM so Excel auto-detects UTF-8
  const csv = '\uFEFF' + [header, ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const name = filename || `geck-inspect-roster-${timestampSlug()}.csv`;
  downloadBlob(blob, name);
  return name;
}

/**
 * Generate a landscape PDF of the gecko roster and trigger a download.
 * Rolls our own lightweight table renderer against jsPDF's primitive
 * text/line APIs ,  avoids needing jspdf-autotable.
 */
export function exportGeckosPDF(geckos, { title, filename, userName } = {}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const usable = pageWidth - margin * 2;

  // Normalize column widths to the usable page width
  const totalWidth = COLUMNS.reduce((sum, c) => sum + c.width, 0);
  const scale = usable / totalWidth;
  const widths = COLUMNS.map((c) => c.width * scale);

  // --- Header block ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(title || 'Gecko Roster', margin, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const metaLine = [
    `${geckos.length} gecko${geckos.length === 1 ? '' : 's'}`,
    userName ? `Exported by ${userName}` : null,
    `Generated ${new Date().toLocaleDateString()}`,
    'geckinspect.com',
  ]
    .filter(Boolean)
    .join(' · ');
  doc.text(metaLine, margin, 24);

  // --- Table ---
  let y = 32;
  const rowHeight = 7;
  const headerHeight = 8;

  const drawHeader = () => {
    doc.setFillColor(15, 23, 42);   // slate-900
    doc.rect(margin, y, usable, headerHeight, 'F');
    doc.setTextColor(226, 232, 240); // slate-200
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let x = margin + 2;
    COLUMNS.forEach((col, i) => {
      doc.text(col.header, x, y + 5.5, { maxWidth: widths[i] - 3 });
      x += widths[i];
    });
    y += headerHeight;
  };

  drawHeader();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  geckos.forEach((gecko, rowIdx) => {
    // New page if we're about to overflow
    if (y + rowHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawHeader();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
    }

    // Zebra stripes
    if (rowIdx % 2 === 0) {
      doc.setFillColor(241, 245, 249); // slate-100
      doc.rect(margin, y, usable, rowHeight, 'F');
    }

    doc.setTextColor(30, 41, 59); // slate-800
    let x = margin + 2;
    COLUMNS.forEach((col, i) => {
      let text = renderCell(gecko, col);
      // Clip to column width (no wrap ,  landscape table)
      const maxW = widths[i] - 3;
      // Truncate to something the column can actually hold. jsPDF's
      // maxWidth would wrap, which breaks our fixed row height.
      const splitLines = doc.splitTextToSize(text, maxW);
      const clipped = splitLines[0] || '';
      const finalText = splitLines.length > 1 ? clipped.slice(0, -1) + '…' : clipped;
      doc.text(finalText, x, y + 5, { maxWidth: maxW });
      x += widths[i];
    });
    y += rowHeight;
  });

  // --- Footer on every page ---
  const totalPages = doc.internal.pages.length - 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${p} of ${totalPages}  ·  Generated by Geck Inspect (geckOS)`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  const name = filename || `geck-inspect-roster-${timestampSlug()}.pdf`;
  doc.save(name);
  return name;
}
