import { describe, expect, it } from 'vitest';
import { ageText, buildBuyerPacket, packetFilename, renderBuyerPacketPDF, safeText } from '../buyerPacket';

const now = new Date('2026-09-28T12:00:00');

const gecko = {
  id: 'g1',
  name: 'Pip',
  gecko_id_code: 'TT-26-014',
  sex: 'Female',
  hatch_date: '2025-06-10',
  morphs_traits: 'Lilly White, Harlequin',
  genetics_notes: '50% poss het Axanthic',
  notes: 'Private: bought the dam cheap from a friend',
  sire_id: 's1',
  dam_name: 'Mango (not in records)',
};
const sire = { id: 's1', name: 'Zeus', gecko_id_code: 'TT-21-002', morph_tags: ['Pinstripe'], sire_id: 'gs1' };

describe('ageText', () => {
  it('writes years and months, or days for a young hatchling', () => {
    expect(ageText('2025-06-10', now)).toBe('1 year, 3 months');
    expect(ageText('2026-09-01', now)).toBe('27 days');
    expect(ageText('2027-01-01', now)).toBeNull();
  });
});

describe('buildBuyerPacket', () => {
  const packet = buildBuyerPacket({
    gecko,
    sire,
    grandparents: { gsS: { name: 'Atlas' } },
    weights: [
      { weight_grams: 18, record_date: '2026-07-01' },
      { weight_grams: 24, record_date: '2026-09-20' },
      { weight_grams: null, record_date: '2026-08-01' },
    ],
    feedings: [
      { date: '2026-09-25', food_type: 'Pangea Fig & Insects', accepted: true },
      { date: '2026-09-22', food_type: 'Crickets', accepted: false },
    ],
    feedingGroup: { diet_type: 'Complete diet (CGD)', interval_days: 3 },
    seller: { breeder_name: 'Tennyson Geckos', email: 'seller@example.com' },
    passportUrl: 'https://geckinspect.com/passport/ABC123',
    now,
  });

  it('lists the key facts with the latest weight and age', () => {
    expect(packet.facts).toEqual([
      ['ID code', 'TT-26-014'],
      ['Sex', 'Female'],
      ['Hatched', 'Jun 10, 2025 (1 year, 3 months)'],
      ['Weight', '24 g on Sep 20, 2026'],
      ['Traits', 'Lilly White, Harlequin'],
      ['Genetics', '50% poss het Axanthic'],
    ]);
  });

  it('never includes the private notes', () => {
    expect(JSON.stringify(packet)).not.toContain('Private');
  });

  it('uses parent records when present and the typed-in name otherwise', () => {
    expect(packet.lineage.sire).toEqual({ name: 'Zeus', id: 'TT-21-002', traits: 'Pinstripe' });
    expect(packet.lineage.dam).toEqual({ name: 'Mango (not in records)', id: null, traits: null });
    expect(packet.lineage.grandparents).toEqual([['Paternal grandsire', 'Atlas']]);
  });

  it('orders weights and feedings newest first and describes the diet', () => {
    expect(packet.weights).toEqual([['Sep 20, 2026', '24 g'], ['Jul 1, 2026', '18 g']]);
    expect(packet.feedings).toEqual([
      ['Sep 25, 2026', 'Pangea Fig & Insects', 'Ate'],
      ['Sep 22, 2026', 'Crickets', 'Refused'],
    ]);
    expect(packet.diet).toEqual(['Diet: Complete diet (CGD)', 'Fed every 3 days']);
  });

  it('renders a PDF without a photo or QR code', () => {
    const doc = renderBuyerPacketPDF(packet);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(1000);
  });
});

describe('text helpers', () => {
  it('scrubs characters helvetica cannot draw and builds a safe filename', () => {
    expect(safeText('Zeus \u00D7 Mango \u2014 2026')).toBe('Zeus x Mango - 2026');
    expect(packetFilename({ gecko_id_code: 'TT 26/014' })).toBe('buyer-packet-TT-26-014.pdf');
  });
});
