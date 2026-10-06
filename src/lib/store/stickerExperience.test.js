import { describe, expect, it } from 'vitest';
import { createDefaultDesign, normalizePhotoCrop, serializeDesign, stickerDimensions, validateDesign, designSummary } from './customSticker';
import { designFromGecko, stickerGeckoLocation } from './stickerGecko';

describe('collection handoff and enclosure plaques', () => {
  const gecko = { name: 'Moonlight', species: 'Crested Gecko', morphs_traits: 'Lavender', image_urls: ['/my-photo.webp'], hatch_date: '2024-03-12', notes: 'Private keeper notes', created_by: 'private@example.com' };
  it('passes only the fields needed by the studio, without changing collection data', () => {
    const location = stickerGeckoLocation(gecko, 'enclosure_plaque');
    expect(location.pathname).toBe('/Store/stickers');
    expect(location.search).toBe('?theme=enclosure_plaque');
    expect(location.state.stickerGecko).not.toHaveProperty('notes');
    expect(location.state.stickerGecko).not.toHaveProperty('created_by');
    const plaque = designFromGecko(location.state.stickerGecko, 'enclosure_plaque');
    expect(plaque.name).toBe('Moonlight');
    expect(plaque.scientific_name).toBe('Correlophus ciliatus');
    expect(plaque.native_range).toBe('New Caledonia · South Pacific');
    expect(plaque.hatch_label).toBe('2024-03-12');
    expect(gecko.image_urls).toEqual(['/my-photo.webp']);
  });
  it('does not invent native range or scientific names for an unrecognized species', () => {
    const plaque = designFromGecko({ ...gecko, species: 'Unlisted Gecko' }, 'enclosure_plaque');
    expect(plaque.species_name).toBe('Unlisted Gecko');
    expect(plaque.scientific_name).toBe('');
    expect(plaque.native_range).toBe('');
    expect(validateDesign(plaque)).toEqual(['Add the scientific name.', 'Add the species’ native range.']);
  });
  it('prefills other verified species without inventing habitat details', () => {
    const plaque = designFromGecko({ ...gecko, species: 'Gargoyle Gecko' }, 'enclosure_plaque');
    expect(plaque.scientific_name).toBe('Rhacodactylus auriculatus');
    expect(plaque.native_range).toContain('Southern New Caledonia');
    expect(plaque.habitat).toBe('');
    expect(serializeDesign(plaque).photo_url).toBe('');
  });
  it('allows text-only plaques and requires species identity', () => {
    const plaque = { ...createDefaultDesign(), theme: 'enclosure_plaque', name: 'Luna', photo_url: '' };
    expect(validateDesign(plaque)).toEqual([]);
    expect(validateDesign({ ...plaque, native_range: '' })).toContain('Add the species’ native range.');
    expect(validateDesign({ ...plaque, theme: 'trading_card' })).toContain('Add a photo of your pet.');
  });
  it('serializes plaque fields and crop through cart/order snapshots', () => {
    const serialized = serializeDesign({ ...createDefaultDesign(), theme: 'enclosure_plaque', name: 'Luna', plaque_style: 'ivory', photo_crop: { x: 20, y: 72, zoom: 1.6 }, finish: 'holographic' });
    expect(serialized.plaque_style).toBe('ivory');
    expect(serialized.scientific_name).toBe('Correlophus ciliatus');
    expect(serialized.photo_crop).toEqual({ x: 20, y: 72, zoom: 1.6 });
    expect(serialized.finish).toBe('glossy');
    expect(serializeDesign(serialized)).toEqual(serialized);
    expect(designSummary(serialized)).toContain('Enclosure plaque sticker');
  });
});

describe('printed dimensions and backward compatibility', () => {
  it('uses longest-edge sizes for landscape plaques and portrait cards', () => {
    expect(stickerDimensions({ theme: 'enclosure_plaque', size: '4in' })).toEqual({ width: 4, height: 2, label: '4 × 2 in' });
    expect(stickerDimensions({ theme: 'trading_card', size: '3in' }).label).toBe('2.14 × 3 in');
  });
  it('bounds crop values and supplies centered defaults for old orders', () => {
    expect(normalizePhotoCrop()).toEqual({ x: 50, y: 50, zoom: 1 });
    expect(normalizePhotoCrop({ x: -80, y: 140, zoom: 99 })).toEqual({ x: 0, y: 100, zoom: 3 });
    expect(normalizePhotoCrop({ x: 'bad', zoom: NaN })).toEqual({ x: 50, y: 50, zoom: 1 });
    expect(serializeDesign({ ...createDefaultDesign(), layout: 'unknown', plaque_style: 'unknown' }).layout).toBe('classic');
  });
});
