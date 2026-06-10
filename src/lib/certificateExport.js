import jsPDF from 'jspdf';
import { TRANSFER_METHOD_LABELS } from './passportUtils';

/**
 * Provenance certificate PDF for the animal passport.
 *
 * One public entry point: exportProvenanceCertificate(gecko, ownershipRecords, passportUrl).
 * Renders a clean A4 landscape certificate: Geck Inspect wordmark, animal
 * identity (name, ID code, morph tags, hatch date, breeder), the chain of
 * custody, the passport QR code, and a verification footer.
 *
 * The verification story is the LIVE passport page, and the certificate says
 * so explicitly: paper can be forged, the QR code resolves to the live,
 * timestamped record on geckinspect.com.
 *
 * Drawing follows the same conventions as certificateUtils.js: pure jsPDF
 * text and rectangles, WinAnsi-safe strings via safeText(), and a manual
 * blob download (the pattern known to work in production browsers).
 *
 * The QR code itself is lifted from the passport page when possible: the
 * page renders a hidden <QRCodeCanvas data-passport-qr> and we copy that
 * canvas into the PDF as a PNG. If no canvas is found we fall back to
 * printing the passport URL as text, which still verifies (type it in).
 */

// ---------------------------------------------------------------------------
// Helpers (same conventions as certificateUtils.js, kept local on purpose)
// ---------------------------------------------------------------------------

function fmtDate(value) {
  if (!value) return 'Unknown';
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return 'Unknown';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return 'Unknown';
  }
}

// jsPDF's standard helvetica is WinAnsi-encoded; smart quotes, dashes,
// emoji can break the encoder. Scrub everything before doc.text().
function safeText(value) {
  if (value == null) return '';
  return String(value)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[…]/g, '...')
    .replace(/[^\x20-\x7E]/g, '');
}

function safeFilename(value) {
  if (!value) return 'certificate';
  return (
    String(value)
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'certificate'
  );
}

function downloadPdfBlob(doc, filename) {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Never print a raw email address on a certificate. If owner_name was
// stored as an email, show only the part before the @.
function publicOwnerName(name) {
  if (!name || !String(name).trim()) return 'Verified owner';
  const trimmed = String(name).trim();
  if (trimmed.includes('@')) {
    const local = trimmed.split('@')[0].trim();
    return local || 'Verified owner';
  }
  return trimmed;
}

function sortRecords(records) {
  return [...(records || [])].sort((a, b) => {
    const da = new Date(a.acquired_date || a.created_date || 0);
    const db = new Date(b.acquired_date || b.created_date || 0);
    return da - db;
  });
}

// Combine the base morph string and the trait list into one display line.
function morphLine(gecko) {
  const parts = [];
  const base = gecko?.morphs_traits || gecko?.base_morph;
  if (base) parts.push(base);
  const traits = gecko?.morph_traits;
  const traitList = Array.isArray(traits)
    ? traits
    : (typeof traits === 'string' && traits ? traits.split(',').map(t => t.trim()) : []);
  for (const t of traitList) {
    if (t && !parts.includes(t)) parts.push(t);
  }
  return parts.join(', ');
}

// Grab the hidden QR canvas the passport page renders. Returns a PNG data
// URL, or null when the canvas isn't on the page (caller falls back to text).
function passportQrDataUrl() {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.querySelector('canvas[data-passport-qr]');
    if (canvas && canvas.toDataURL) return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('Passport QR canvas unavailable, falling back to text:', err);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function exportProvenanceCertificate(gecko, ownershipRecords, passportUrl) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();   // 297
  const pageH = doc.internal.pageSize.getHeight();  // 210
  const margin = 12;

  // Outer border
  doc.setDrawColor(86, 107, 95);
  doc.setLineWidth(1.2);
  doc.rect(margin, margin, pageW - margin * 2, pageH - margin * 2);
  doc.setLineWidth(0.3);
  doc.rect(margin + 2, margin + 2, pageW - (margin + 2) * 2, pageH - (margin + 2) * 2);

  // Wordmark + title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(86, 107, 95);
  doc.text('GECK INSPECT', pageW / 2, margin + 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(60, 60, 60);
  doc.text('CERTIFICATE OF PROVENANCE', pageW / 2, margin + 22, { align: 'center' });

  doc.setDrawColor(86, 107, 95);
  doc.setLineWidth(0.5);
  doc.line(pageW / 2 - 55, margin + 26, pageW / 2 + 55, margin + 26);

  // Two-column layout: subject + chain on the left, QR verification on the right
  const innerX = margin + 10;
  const qrBoxW = 70;
  const qrBoxX = pageW - margin - 10 - qrBoxW;
  const leftW = qrBoxX - innerX - 8;
  let y = margin + 38;

  // ── Subject ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(40, 40, 40);
  doc.text(safeText(gecko?.name || 'Unnamed Gecko'), innerX, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(86, 107, 95);
  const idBits = [
    gecko?.passport_code ? `Passport ${gecko.passport_code}` : null,
    gecko?.gecko_id_code ? `ID ${gecko.gecko_id_code}` : null,
  ].filter(Boolean).join('  |  ');
  if (idBits) {
    doc.text(safeText(idBits), innerX, y);
    y += 6;
  }

  const morphs = morphLine(gecko);
  if (morphs) {
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    const morphLines = doc.splitTextToSize(safeText(morphs), leftW);
    doc.text(morphLines.slice(0, 2), innerX, y);
    y += Math.min(morphLines.length, 2) * 5 + 2;
  }

  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const factBits = [
    `Species: ${safeText(gecko?.species || 'Correlophus ciliatus')}`,
    gecko?.sex ? `Sex: ${safeText(gecko.sex)}` : null,
    `Hatched: ${fmtDate(gecko?.hatch_date || gecko?.date_of_birth)}`,
  ].filter(Boolean).join('    ');
  doc.text(factBits, innerX, y);
  y += 6;

  if (gecko?.breeder_name) {
    const bredBy = gecko.hatch_facility
      ? `Bred by ${safeText(gecko.breeder_name)} (${safeText(gecko.hatch_facility)})`
      : `Bred by ${safeText(gecko.breeder_name)}`;
    doc.text(bredBy, innerX, y);
    y += 6;
  }
  y += 3;

  // ── Chain of custody ──
  doc.setFillColor(86, 107, 95);
  doc.rect(innerX, y, leftW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('CHAIN OF CUSTODY', innerX + 3, y + 5);
  y += 12;

  const chain = sortRecords(ownershipRecords);
  const footerY = pageH - margin - 24;
  const rowH = 7;
  const maxRows = Math.max(1, Math.floor((footerY - y - 6) / rowH));

  if (chain.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text('Original owner, no transfers recorded.', innerX + 2, y);
    y += rowH;
  } else {
    // If the chain is longer than the page allows, keep the origin record
    // and the most recent transfers, and say how many were skipped.
    let rows = chain;
    let skipped = 0;
    if (chain.length > maxRows) {
      const keepTail = maxRows - 1;
      rows = [chain[0], ...chain.slice(chain.length - keepTail)];
      skipped = chain.length - rows.length;
    }
    rows.forEach((r, i) => {
      const isOrigin = i === 0;
      const name = publicOwnerName(r.owner_name);
      const method = r.transfer_method
        ? TRANSFER_METHOD_LABELS[r.transfer_method] || r.transfer_method
        : (isOrigin ? TRANSFER_METHOD_LABELS.original_breeder : null);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(safeText(`${i + 1}. ${name}`), innerX + 2, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      const meta = [
        r.acquired_date ? fmtDate(r.acquired_date) : 'Date not recorded',
        method,
      ].filter(Boolean).join('  |  ');
      doc.text(safeText(meta), innerX + leftW * 0.5, y);

      y += rowH;
      if (skipped > 0 && i === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(130, 130, 130);
        doc.text(
          safeText(`... ${skipped} earlier transfer${skipped === 1 ? '' : 's'} omitted, full chain on the live passport`),
          innerX + 4,
          y - 1.5
        );
        y += 4;
      }
    });
  }

  // ── QR verification panel (right column) ──
  let qrY = margin + 36;
  doc.setDrawColor(200, 205, 200);
  doc.setLineWidth(0.3);
  doc.rect(qrBoxX, qrY, qrBoxW, 96);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(86, 107, 95);
  doc.text('VERIFY THIS ANIMAL', qrBoxX + qrBoxW / 2, qrY + 8, { align: 'center' });

  const qrDataUrl = passportQrDataUrl();
  if (qrDataUrl) {
    const qrSize = 48;
    doc.addImage(qrDataUrl, 'PNG', qrBoxX + (qrBoxW - qrSize) / 2, qrY + 12, qrSize, qrSize);
    qrY += 12 + 48 + 6;
  } else {
    qrY += 16;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  const verifyCopy = doc.splitTextToSize(
    safeText(
      'Paper can be forged. The live passport record cannot. Scan the QR code or visit the link below to see the current owner and the full timestamped chain of custody on Geck Inspect.'
    ),
    qrBoxW - 8
  );
  doc.text(verifyCopy, qrBoxX + 4, qrY);
  qrY += verifyCopy.length * 3.4 + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(86, 107, 95);
  const urlLines = doc.splitTextToSize(safeText(passportUrl || ''), qrBoxW - 8);
  doc.text(urlLines, qrBoxX + 4, qrY);

  // ── Footer ──
  doc.setDrawColor(86, 107, 95);
  doc.setLineWidth(0.4);
  doc.line(margin + 10, pageH - margin - 16, pageW - margin - 10, pageH - margin - 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(safeText(`Verify live at ${passportUrl || 'geckinspect.com'}`), margin + 10, pageH - margin - 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    safeText(`Generated by Geck Inspect | geckinspect.com | ${new Date().toLocaleDateString()}`),
    margin + 10,
    pageH - margin - 5.5
  );
  doc.text(
    safeText(`Certificate ID: PROV-${String(gecko?.id || '').substring(0, 8).toUpperCase()}`),
    pageW - margin - 10,
    pageH - margin - 5.5,
    { align: 'right' }
  );

  const slug = safeFilename(gecko?.passport_code || gecko?.gecko_id_code || gecko?.name);
  downloadPdfBlob(doc, `provenance-certificate-${slug}.pdf`);
}
