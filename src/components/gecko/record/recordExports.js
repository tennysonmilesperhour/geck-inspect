/**
 * The record's paper exports: the ownership and lineage certificates and
 * the buyer packet.
 *
 * The PDF code is fetched only when a member taps one of those buttons.
 * Before, the record window imported it at the top, so every visit to My
 * Geckos downloaded the certificate and buyer packet builders whether or
 * not anyone printed anything. Those modules load jsPDF the same way, at
 * the moment of drawing.
 */
import { Gecko, FeedingRecord, FeedingGroup } from '@/entities/all';
import { FIRE_SLOTS, fireStatePhotos } from '@/lib/fireStatePhotos';
import { importWithRetry } from './loadOnDemand';

/**
 * Parents and grandparents for the papers. Uses the geckos the host already
 * has (the collection in My Geckos, the parents the record loaded) and asks
 * the database only for the ones it is missing, so the page and the window
 * print the same lineage.
 */
export async function resolveLineage(gecko, known = []) {
  const byId = new Map();
  for (const g of known || []) if (g?.id) byId.set(g.id, g);
  const lookup = async (id) => {
    if (!id) return null;
    if (byId.has(id)) return byId.get(id);
    const row = await Gecko.get(id).catch(() => null);
    if (row) byId.set(id, row);
    return row;
  };
  const [sire, dam] = await Promise.all([lookup(gecko?.sire_id), lookup(gecko?.dam_id)]);
  const [gsS, gdS, gsD, gdD] = await Promise.all([
    lookup(sire?.sire_id),
    lookup(sire?.dam_id),
    lookup(dam?.sire_id),
    lookup(dam?.dam_id),
  ]);
  return { sire, dam, grandparents: { gsS, gdS, gsD, gdD } };
}

/** Download the ownership ('ownership') or lineage ('lineage') certificate. */
export async function downloadCertificate(type, { gecko, owner, known, eggs = [], plans = [], weights = [] }) {
  const [certificates, lineage] = await Promise.all([
    importWithRetry(() => import('@/lib/certificateUtils')),
    resolveLineage(gecko, known),
  ]);
  const breedingHistory = { eggs, breedingPlans: plans, weightRecords: weights, hatchDate: gecko?.hatch_date };
  if (type === 'ownership') {
    await certificates.generateOwnershipCertificatePDF(gecko, owner, { breedingHistory });
  } else {
    await certificates.generateLineageCertificatePDF({
      gecko,
      sire: lineage.sire,
      dam: lineage.dam,
      grandparents: lineage.grandparents,
      owner,
      breedingHistory,
    });
  }
}

/**
 * Build and download the buyer packet: one PDF to hand over with a sold
 * gecko (photo, traits, lineage, weights, feeding, passport QR). Private
 * notes stay out. Returns the passport link it printed, or null.
 */
export async function downloadBuyerPacket({ gecko, seller, known, weights = [] }) {
  const [packetLib, assets, lineage] = await Promise.all([
    importWithRetry(() => import('@/lib/buyerPacket')),
    importWithRetry(() => import('@/lib/buyerPacketAssets')),
    resolveLineage(gecko, known),
  ]);
  const [feedings, feedingGroup] = await Promise.all([
    FeedingRecord.filter({ animal_id: gecko.id }, '-date', 8).catch(() => []),
    gecko.feeding_group_id
      ? FeedingGroup.filter({ id: gecko.feeding_group_id }).then((rows) => rows?.[0] || null).catch(() => null)
      : Promise.resolve(null),
  ]);
  const passportUrl = gecko.passport_code ? `${window.location.origin}/passport/${gecko.passport_code}` : null;
  const fireSlots = fireStatePhotos(gecko);
  const [photo, qr, firedUp, firedDown] = await Promise.all([
    assets.photoDataUrl(gecko.image_urls?.[0]),
    assets.qrDataUrl(passportUrl),
    assets.photoDataUrl(fireSlots.fired_up),
    assets.photoDataUrl(fireSlots.fired_down),
  ]);
  const firePhotos = FIRE_SLOTS.map((slot, i) => ({ label: slot.label, dataUrl: [firedUp, firedDown][i] }));
  const packet = packetLib.buildBuyerPacket({
    gecko,
    sire: lineage.sire,
    dam: lineage.dam,
    grandparents: lineage.grandparents,
    weights,
    feedings: feedings || [],
    feedingGroup,
    seller,
    passportUrl,
  });
  assets.downloadPdf(await packetLib.renderBuyerPacketPDF(packet, { photo, qr, firePhotos }), packetLib.packetFilename(gecko));
  return passportUrl;
}
