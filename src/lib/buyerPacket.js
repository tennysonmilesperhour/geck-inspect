import jsPDF from 'jspdf';

/**
 * Buyer packet: one PDF a breeder hands over with a sold gecko. It holds
 * what a new keeper needs and what backs up the sale: photo, traits and
 * genetics notes, parents and grandparents, recent weights, diet and
 * recent feedings, and the passport QR code that opens the gecko's live
 * record.
 *
 * The gecko's private notes are never included.
 *
 * buildBuyerPacket() turns records into plain sections (tested);
 * renderBuyerPacketPDF() draws them with jsPDF's built-in helvetica,
 * the same approach as certificateUtils.js.
 */

const MAX_WEIGHTS = 10;
const MAX_FEEDINGS = 8;

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value) {
  const d = toDate(value);
  return d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown';
}

/** "1 year, 3 months" style age from a hatch date. */
export function ageText(hatchDate, now = new Date()) {
  const d = toDate(hatchDate);
  if (!d || d > now) return null;
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months -= 1;
  if (months < 1) {
    const days = Math.max(0, Math.floor((now - d) / 86400000));
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [];
  if (years) parts.push(`${years} year${years === 1 ? '' : 's'}`);
  if (rest) parts.push(`${rest} month${rest === 1 ? '' : 's'}`);
  return parts.join(', ');
}

function parentLine(g) {
  if (!g) return null;
  return { name: g.name || 'Unnamed', id: g.gecko_id_code || null, traits: g.morphs_traits || (g.morph_tags || []).join(', ') || null };
}

/**
 * Plain sections for the packet. Parents fall back to the typed-in sire
 * and dam names when the parent is not in the seller's records.
 */
export function buildBuyerPacket({
  gecko, sire = null, dam = null, grandparents = {}, weights = [], feedings = [],
  feedingGroup = null, seller = null, passportUrl = null, now = new Date(),
}) {
  const sortedWeights = [...weights]
    .filter((w) => w && w.weight_grams != null && w.record_date)
    .sort((a, b) => String(b.record_date).localeCompare(String(a.record_date)));
  const latest = sortedWeights[0] || null;
  const sortedFeedings = [...feedings]
    .filter((f) => f && f.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const facts = [
    ['ID code', gecko?.gecko_id_code],
    ['Sex', gecko?.sex],
    ['Hatched', gecko?.hatch_date ? `${formatDate(gecko.hatch_date)}${ageText(gecko.hatch_date, now) ? ` (${ageText(gecko.hatch_date, now)})` : ''}` : null],
    ['Weight', latest ? `${latest.weight_grams} g on ${formatDate(latest.record_date)}` : gecko?.weight_grams != null ? `${gecko.weight_grams} g` : null],
    ['Traits', gecko?.morphs_traits || (gecko?.morph_tags || []).join(', ') || null],
    ['Genetics', gecko?.genetics_notes || null],
    ['Bred by', gecko?.breeder_name || null],
  ].filter(([, v]) => v);

  const sireLine = parentLine(sire) || (gecko?.sire_name ? { name: gecko.sire_name, id: null, traits: null } : null);
  const damLine = parentLine(dam) || (gecko?.dam_name ? { name: gecko.dam_name, id: null, traits: null } : null);
  const gp = [
    ['Paternal grandsire', grandparents.gsS],
    ['Paternal granddam', grandparents.gdS],
    ['Maternal grandsire', grandparents.gsD],
    ['Maternal granddam', grandparents.gdD],
  ].filter(([, g]) => g).map(([label, g]) => [label, g.name || 'Unnamed']);

  const diet = [];
  if (feedingGroup?.diet_type) diet.push(`Diet: ${feedingGroup.diet_type}`);
  if (feedingGroup?.interval_days) diet.push(`Fed every ${feedingGroup.interval_days} day${Number(feedingGroup.interval_days) === 1 ? '' : 's'}`);

  return {
    title: gecko?.name || 'Unnamed gecko',
    seller: seller?.breeder_name || seller?.full_name || seller?.email || null,
    sellerContact: seller?.email || null,
    sellerWebsite: seller?.website_url || null,
    generated: formatDate(now),
    facts,
    lineage: { sire: sireLine, dam: damLine, grandparents: gp },
    weights: sortedWeights.slice(0, MAX_WEIGHTS).map((w) => [formatDate(w.record_date), `${w.weight_grams} g`]),
    diet,
    feedings: sortedFeedings.slice(0, MAX_FEEDINGS).map((f) => [
      formatDate(f.date),
      f.food_type || 'Meal',
      f.accepted === false ? 'Refused' : f.accepted === true ? 'Ate' : '',
    ]),
    passportUrl,
  };
}

// jsPDF's helvetica is WinAnsi-encoded; scrub anything it cannot draw.
export function safeText(value) {
  if (value == null) return '';
  return String(value)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00D7/g, 'x')
    .replace(/[\u2026]/g, '...')
    .replace(/[^\x20-\x7E]/g, '');
}

export function packetFilename(gecko) {
  const base = String(gecko?.gecko_id_code || gecko?.name || 'gecko')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'gecko';
  return `buyer-packet-${base}.pdf`;
}

const GREEN = [86, 107, 95];

/**
 * Draw the packet. photo and qr are optional PNG/JPEG data URLs.
 * firePhotos is an optional list of { label, dataUrl } for the gecko's
 * fired-up and fired-down photos (src/lib/fireStatePhotos.js); entries
 * without a dataUrl are skipped. Returns the jsPDF document.
 */
export function renderBuyerPacketPDF(packet, { photo = null, qr = null, firePhotos = [] } = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const width = pageW - margin * 2;
  let y = margin;

  const ensure = (needed) => {
    if (y + needed > pageH - margin - 10) {
      doc.addPage();
      y = margin;
    }
  };
  // keepWith: room the section's first content needs, so a heading never
  // sits alone at the bottom of a page.
  const section = (title, keepWith = 8) => {
    ensure(12 + keepWith);
    doc.setFillColor(...GREEN);
    doc.rect(margin, y, width, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(safeText(title.toUpperCase()), margin + 3, y + 5);
    y += 12;
  };
  const labelValue = (label, value, x, w) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(safeText(label.toUpperCase()), x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    const lines = doc.splitTextToSize(safeText(value) || '-', w).slice(0, 3);
    doc.text(lines, x, y + 4.5);
    return 4 + lines.length * 4.5 + 1.5;
  };

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...GREEN);
  doc.text(safeText(packet.title), margin, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(safeText(`Buyer packet${packet.seller ? ` from ${packet.seller}` : ''}, ${packet.generated}`), margin, y + 12);
  const contact = [packet.sellerContact, packet.sellerWebsite].filter(Boolean).join('  |  ');
  if (contact) doc.text(safeText(`Questions about this gecko: ${contact}`), margin, y + 17);
  const rule = contact ? y + 20 : y + 15;
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.5);
  doc.line(margin, rule, pageW - margin, rule);
  y = rule + 7;

  // Photo and key facts
  const photoSize = 56;
  const factsX = photo ? margin + photoSize + 6 : margin;
  const factsW = photo ? width - photoSize - 6 : width;
  const top = y;
  if (photo) {
    try {
      doc.addImage(photo, photo.startsWith('data:image/png') ? 'PNG' : 'JPEG', margin, y, photoSize, photoSize);
    } catch {
      // An image jsPDF cannot read is left out rather than failing the packet.
    }
  }
  for (const [label, value] of packet.facts) y += labelValue(label, value, factsX, factsW);
  y = Math.max(y, photo ? top + photoSize + 4 : y) + 2;

  // Fired up and fired down, side by side
  const fired = (firePhotos || []).filter((f) => f?.dataUrl);
  if (fired.length) {
    const size = 50;
    section('Fired up and fired down', size + 8);
    fired.forEach((f, i) => {
      const x = margin + i * (size + 8);
      try {
        doc.addImage(f.dataUrl, f.dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG', x, y, size, size);
      } catch {
        // Skip a photo jsPDF cannot read.
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(safeText(f.label), x, y + size + 4.5);
    });
    y += size + 10;
  }

  // Lineage
  const { sire, dam, grandparents } = packet.lineage;
  if (sire || dam || grandparents.length) {
    section('Lineage');
    const colW = (width - 6) / 2;
    const start = y;
    let left = 0;
    let right = 0;
    if (sire) {
      left = labelValue('Sire (father)', [sire.name, sire.id && `ID ${sire.id}`, sire.traits].filter(Boolean).join('  |  '), margin, colW);
    }
    if (dam) {
      y = start;
      right = labelValue('Dam (mother)', [dam.name, dam.id && `ID ${dam.id}`, dam.traits].filter(Boolean).join('  |  '), margin + colW + 6, colW);
    }
    y = start + Math.max(left, right);
    if (grandparents.length) {
      const quarter = (width - 9) / 4;
      const rowStart = y;
      let tallest = 0;
      grandparents.forEach(([label, name], i) => {
        y = rowStart;
        tallest = Math.max(tallest, labelValue(label, name, margin + i * (quarter + 3), quarter));
      });
      y = rowStart + tallest;
    }
    y += 2;
  }

  // Weights
  if (packet.weights.length) {
    section('Recent weights');
    const colW = width / 2;
    packet.weights.forEach(([date, grams], i) => {
      const col = i < Math.ceil(packet.weights.length / 2) ? 0 : 1;
      const row = col === 0 ? i : i - Math.ceil(packet.weights.length / 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.text(safeText(date), margin + col * colW, y + row * 5.5);
      doc.text(safeText(grams), margin + col * colW + 45, y + row * 5.5);
    });
    y += Math.ceil(packet.weights.length / 2) * 5.5 + 4;
  }

  // Feeding
  if (packet.diet.length || packet.feedings.length) {
    section('Feeding');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    if (packet.diet.length) {
      doc.text(safeText(packet.diet.join('. ')), margin, y);
      y += 7;
    }
    for (const [date, food, result] of packet.feedings) {
      ensure(6);
      doc.text(safeText(date), margin, y);
      doc.text(safeText(food), margin + 40, y);
      if (result) doc.text(safeText(result), margin + width - 20, y);
      y += 5.5;
    }
    y += 3;
  }

  // Passport and care guide
  const qrSize = 30;
  section(packet.passportUrl ? 'Live record' : 'Care guide', qr ? qrSize + 2 : 10);
  const textX = qr ? margin + qrSize + 6 : margin;
  const textW = qr ? width - qrSize - 6 : width;
  if (qr) {
    try { doc.addImage(qr, 'PNG', margin, y - 2, qrSize, qrSize); } catch { /* skip */ }
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  const passportLines = packet.passportUrl
    ? [
      'Scan the code or open the link to see this gecko\'s passport: its live record on Geck Inspect, including its weight and ownership history.',
      packet.passportUrl,
      '',
      'Crested gecko care guide: geckinspect.com/CareGuide',
    ]
    : ['Crested gecko care guide: geckinspect.com/CareGuide'];
  let ty = y + 3;
  for (const line of passportLines) {
    const wrapped = doc.splitTextToSize(safeText(line), textW);
    doc.text(wrapped, textX, ty);
    ty += Math.max(1, wrapped.length) * 4.8;
  }
  y = Math.max(ty, qr ? y + qrSize : ty) + 4;

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(safeText(`Made with Geck Inspect | geckinspect.com | page ${i} of ${pages}`), margin, pageH - 8);
  }
  return doc;
}
