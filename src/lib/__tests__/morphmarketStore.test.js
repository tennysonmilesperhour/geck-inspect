import { describe, expect, it } from 'vitest';
import { looksBlocked, newVerifyCode, pageHasCode, parseStoreSlug, storeUrl } from '../morphmarketStore';
import { buildMorphMarketCSV, morphMarketAnimalId, parseMorphMarketCSV } from '../morphmarketSync';

describe('MorphMarket store verification', () => {
  it('reads the store handle from a link or a bare handle', () => {
    expect(parseStoreSlug('https://www.morphmarket.com/stores/TheCrestedCove/')).toBe('thecrestedcove');
    expect(parseStoreSlug('morphmarket.com/stores/lilly-white_co?ref=x')).toBe('lilly-white_co');
    expect(parseStoreSlug('https://www.morphmarket.com/us/stores/harlequinhouse')).toBe('harlequinhouse');
    expect(parseStoreSlug('harlequinhouse')).toBe('harlequinhouse');
  });

  it('refuses things that are not a store', () => {
    expect(parseStoreSlug('')).toBeNull();
    expect(parseStoreSlug('https://www.morphmarket.com/c/reptiles/lizards/crested-geckos')).toBeNull();
    expect(parseStoreSlug('https://evil.example/stores/x')).toBeNull();
    expect(parseStoreSlug('two words')).toBeNull();
  });

  it('builds the public store link', () => {
    expect(storeUrl('harlequinhouse')).toBe('https://www.morphmarket.com/stores/harlequinhouse/');
  });

  it('makes codes the database accepts', () => {
    for (let i = 0; i < 50; i += 1) expect(newVerifyCode()).toMatch(/^GI-[A-Z0-9]{6}$/);
    expect(newVerifyCode(new Uint8Array([0, 1, 2, 3, 4, 5]))).toBe('GI-ABCDEF');
  });

  it('finds the code however the member typed it', () => {
    expect(pageHasCode('<p>Lilly Whites and Phantoms. GI-7K3P9Q</p>', 'GI-7K3P9Q')).toBe(true);
    expect(pageHasCode('<p>gi-7k3p9q</p>', 'GI-7K3P9Q')).toBe(true);
    expect(pageHasCode('<p>GI - 7K3P9Q</p>', 'GI-7K3P9Q')).toBe(true);
    expect(pageHasCode('<p>GI&#45;7K3P9Q</p>', 'GI-7K3P9Q')).toBe(true);
  });

  it('does not match a different or longer code', () => {
    expect(pageHasCode('<p>GI-7K3P9R</p>', 'GI-7K3P9Q')).toBe(false);
    expect(pageHasCode('<p>GI-7K3P9QX</p>', 'GI-7K3P9Q')).toBe(false);
    expect(pageHasCode('<p>GI-7K3P9Q</p>', '')).toBe(false);
  });

  it('treats a bot check as unreadable, not as a missing code', () => {
    expect(looksBlocked(403, '')).toBe(true);
    expect(looksBlocked(200, '<title>Just a moment...</title>')).toBe(true);
    expect(looksBlocked(200, '<h1>The Crested Cove</h1>')).toBe(false);
  });
});

describe('MorphMarket CSV', () => {
  it('writes an Animal ID first so a second upload updates listings', () => {
    const csv = buildMorphMarketCSV([{ id: 'abc', gecko_id_code: 'TCC 24-031', sex: 'Female' }]);
    const [header, row] = csv.replace(/^\uFEFF/, '').split('\r\n');
    expect(header.split(',')[0]).toBe('Animal_ID');
    expect(row.split(',')[0]).toBe('TCC-24-031');
  });

  it('falls back to the record id and drops characters MorphMarket refuses', () => {
    expect(morphMarketAnimalId({ id: 'f3a1-77', gecko_id_code: '' })).toBe('f3a1-77');
    expect(morphMarketAnimalId({ id: 'x', gecko_id_code: 'Cove#12!' })).toBe('Cove12');
  });

  it("reads MorphMarket's own header spellings", () => {
    const csv = 'Animal Id,Title,Sex,Birth Date,Desc,Photo Urls\r\nTCC-1,Lilly White Female,Female,2025-05-01,Calm,"https://a.jpg,https://b.jpg"';
    const { records } = parseMorphMarketCSV(csv);
    expect(records[0]).toMatchObject({
      gecko_id_code: 'TCC-1',
      sex: 'Female',
      hatch_date: '2025-05-01',
      notes: 'Calm',
      image_urls: ['https://a.jpg', 'https://b.jpg'],
    });
  });

  it('reads back the file it writes', () => {
    const csv = buildMorphMarketCSV([{ id: 'g1', gecko_id_code: 'TCC-9', morphs_traits: 'Harlequin', sex: 'Male', hatch_date: '2025-01-02', image_urls: ['https://a.jpg'] }]);
    const { records } = parseMorphMarketCSV(csv);
    expect(records[0]).toMatchObject({ gecko_id_code: 'TCC-9', sex: 'Male', hatch_date: '2025-01-02', image_urls: ['https://a.jpg'] });
  });
});
