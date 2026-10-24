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

describe('live MorphMarket field contract (24 October 2026)', () => {
  it('uses supported headers, trait separators, maturity and whole grams', () => {
    const hatch = new Date();
    hatch.setUTCMonth(hatch.getUTCMonth() - 10);
    const csv = buildMorphMarketCSV([{
      id: 'contract-1', status: 'For Sale', asking_price: 250,
      hatch_date: hatch.toISOString().slice(0, 10), weight_grams: 24.7,
      morphs_traits: 'Lilly White, Harlequin', marketplace_description: 'Calm',
      image_urls: ['https://example.com/one.jpg', 'https://example.com/two.jpg'],
    }]);
    const header = csv.replace(/^\uFEFF/, '').split('\r\n')[0].split(',');
    expect(header).toContain('State');
    expect(header).toContain('Desc');
    expect(header).toContain('Photo_Urls');
    expect(header).not.toContain('Status');
    expect(header).not.toContain('Currency');
    expect(csv).toContain('Subadult');
    expect(csv).toContain('Lilly White  Harlequin');
    expect(parseMorphMarketCSV(csv).records[0]).toMatchObject({ asking_price: 250, weight_grams: 25, status: 'For Sale' });
  });

  it('omits all-empty optional columns but keeps values aligned in mixed batches', () => {
    const blank = buildMorphMarketCSV([{ id: 'a' }, { id: 'b' }]);
    const header = blank.split('\r\n')[0].split(',');
    for (const name of ['Price', 'Weight', 'DOB', 'Desc', 'Photo_Urls']) expect(header).not.toContain(name);
    const mixed = buildMorphMarketCSV([{ id: 'a', asking_price: 250, weight_grams: 18, hatch_date: '2025-05-01' }, { id: 'b' }]);
    const { records } = parseMorphMarketCSV(mixed);
    expect(records[0]).toMatchObject({ asking_price: 250, weight_grams: 18, hatch_date: '2025-05-01' });
    expect(records[1]).not.toHaveProperty('asking_price');
    expect(records[1]).not.toHaveProperty('weight_grams');
    expect(records[1]).not.toHaveProperty('hatch_date');
  });

  it('reads State, sex initials and both photo separators without making private animals public', () => {
    const { records } = parseMorphMarketCSV('Animal_Id,Title,State,Visibility,Enabled,Sex,Photo_Urls\nA,Lilly White,Not For Sale,Public,Active,F,"https://a.jpg https://b.jpg,https://c.jpg"\nB,Harlequin,For Sale,Private,Active,M,\nC,Phantom,For Sale,Public,Inactive,U,\nD,Lilly White,For Sale,Public,Active,F,\nE,Harlequin,For Sale,Unlisted,Active,M,');
    expect(records[0]).toMatchObject({ status: 'Pet', is_public: false, sex: 'Female', image_urls: ['https://a.jpg', 'https://b.jpg', 'https://c.jpg'] });
    expect(records[1]).toMatchObject({ status: 'For Sale', is_public: false, sex: 'Male' });
    expect(records[2].is_public).toBe(false);
    expect(records[3].is_public).toBe(true);
    expect(records[4].is_public).toBe(false);
    expect(parseMorphMarketCSV('Title,Status\nLegacy,Not For Sale').records[0].is_public).toBe(false);
  });

  it('warns instead of inventing a hatch day for partial or invalid dates', () => {
    const { records, warnings } = parseMorphMarketCSV('Animal_Id,Title,Dob\nA,A,2025\nB,B,2025-06\nC,C,2025-02-30\nD,D,2025-06-18');
    expect(warnings).toHaveLength(3);
    for (const row of records.slice(0, 3)) expect(row).not.toHaveProperty('hatch_date');
    expect(records[3].hatch_date).toBe('2025-06-18');
  });
});


describe('actual MorphMarket export shape', () => {
  it('reads starred headers and US dates from a redacted live-export fixture', () => {
    // Header spellings and formats captured from the real 24 October export.
    const csv = 'Category*,Title*,Animal_Id*,Maturity,Price,State,Visibility,Enabled,Sex,Dob,Weight,Quantity,Group_Id,Traits,Photo_Urls,Desc,Last_Update**,Private_Notes\r\nCrested Geckos,Lilly White,GI-TEST-1,adult,700,For Sale,Public,Active,female,6/8/2021,45,1,,Lilly White,"https://example.com/a.jpg,https://example.com/b.jpg",Calm,10/24/2026,Internal\r\nLeachianus Geckos,Other species,OTHER-1,adult,500,For Sale,Public,Active,female,,60,1,,,,,,\r\nCrested Geckos,Harlequin,GI-TEST-2,adult,500,Not For Sale,Private,Inactive,male,6/2023,38,1,,Harlequin,,,,';
    const { records, warnings } = parseMorphMarketCSV(csv);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ name: 'Lilly White', gecko_id_code: 'GI-TEST-1', hatch_date: '2021-06-08', asking_price: 700, weight_grams: 45, notes: 'Calm', image_urls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'] });
    expect(records[1]).toMatchObject({ name: 'Harlequin', gecko_id_code: 'GI-TEST-2', status: 'Pet', is_public: false });
    expect(records[1]).not.toHaveProperty('hatch_date');
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain('Leachianus');
    expect(warnings[1]).toContain('6/2023');
  });

  it('warns about duplicate risk when MorphMarket exports a blank seller ID', () => {
    const result = parseMorphMarketCSV('Category*,Title*,Animal_Id*\nCrested Geckos,Lilly White,');
    expect(result.records[0].name).toBe('Lilly White');
    expect(result.warnings[0]).toContain('no Animal_ID');
  });
});
