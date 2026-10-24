import { describe, it, expect } from 'vitest';
import { MORPHMARKET_KEYS, readMorphMarketSource, matchMorphMarketSource, refreshMorphMarketDraft, morphMarketChanges, morphMarketListingErrors, buildPreservedMorphMarketCSV, exportPreservedMorphMarketCSV, geckoListingSuggestions } from '../morphmarketListing';
import { csvEscape, parseMorphMarketCSV } from '../morphmarketSync';

const fields = (patch = {}) => ({ ...Object.fromEntries(MORPHMARKET_KEYS.map(k => [k, ''])), Animal_ID: 'TEST-A', Category: 'Crested Geckos', Title: 'Lilly White', State: 'Not For Sale', Visibility: 'Private', Enabled: 'Inactive', Sex: 'Male', Maturity: 'Adult', Origin: 'Self Produced', Quantity: '1', Price: '126.0', DOB: '2025-06', Weight: '35', ...patch });
const file = (rows, keys = MORPHMARKET_KEYS) => [keys.map(csvEscape).join(','), ...rows.map(row => keys.map(k => csvEscape(row[k])).join(','))].join('\r\n');

describe('full MorphMarket listing preservation', () => {
  it('round trips all 33 fields and changes only the chosen price', () => {
    const source = fields({ Traits: 'Lilly White', Diet: 'Cricket, Meal Replacement', Length: '12', Length_Type: 'total_length_cm', Proven_Breeder: 'Yes', Min_Shipping: '40', Max_Shipping: '60', Is_Negotiable: 'Firm Price', Is_For_Trade: 'No Trades', "Enable 'Buy Now'": 'No', Group_Id: 'pair-a', Is_Group: 'No', Photo_Urls: 'https://example.com/a.jpg https://example.com/b.jpg', Video_Url: 'https://www.youtube.com/watch?v=test', Is_Rep_Photo: 'No', Desc: 'Public "description"\nSecond line', Wholesale_Price: '80', Wholesale_Only: 'No', Wholesale_Description: 'Wholesale, only', Private_Notes: 'Owner only\nKeep this private' });
    const draft = { ...source, Price: '127' };
    const csv = buildPreservedMorphMarketCSV([{ source, draft }]);
    expect(readMorphMarketSource(csv)[0].fields).toEqual(draft);
    expect(morphMarketChanges(source, draft).map(c => c.key)).toEqual(['Price']);
    expect(MORPHMARKET_KEYS).toHaveLength(33);
    const native = parseMorphMarketCSV(csv).records[0];
    expect(JSON.stringify(native)).not.toContain('Owner only');
    expect(JSON.stringify(native)).not.toContain('Wholesale, only');
    expect(native.hatch_date).toBeUndefined();
  });
  it('reads real export spellings, source dates, groups and reference fields', () => {
    const source = fields({ DOB: '6/8/2025', Is_Group: 'Sold individually', Proven_Breeder: 'True' });
    const headers = MORPHMARKET_KEYS.map(k => k === 'Animal_ID' ? 'Animal_Id*' : k === 'Category' ? 'Category*' : k);
    const csv = `${headers.join(',')},Mm_Url**,Sires**\n${MORPHMARKET_KEYS.map(k => csvEscape(source[k])).join(',')},https://example.com/animal,Parent A`;
    const parsed = readMorphMarketSource(csv)[0];
    expect(parsed.fields).toMatchObject({ DOB: '2025-06-08', Is_Group: 'No', Proven_Breeder: 'Yes' });
    expect(parsed.raw.DOB).toBe('6/8/2025');
    expect(parsed.extra['Sires**']).toBe('Parent A');
    expect(readMorphMarketSource(file([fields({ DOB: '6/2025' })]))[0].fields.DOB).toBe('2025-06');
  });
  it('rejects incomplete, changed and malformed schemas instead of dropping data', () => {
    expect(() => readMorphMarketSource(file([fields()], MORPHMARKET_KEYS.filter(k => k !== 'Private_Notes')))).toThrow('Missing columns');
    expect(() => readMorphMarketSource(file([fields({ New_Field: 'saved' })], [...MORPHMARKET_KEYS, 'New_Field']))).toThrow('cannot preserve');
    expect(() => readMorphMarketSource(file([fields(), fields()]))).toThrow('Duplicate');
    expect(() => readMorphMarketSource(file([fields()]) + ',extra')).toThrow('number of cells');
    expect(() => readMorphMarketSource(file([fields()]) + ',"unfinished')).toThrow('unfinished');
  });
  it('matches exact seller IDs, including archived records, without sanitizing', () => {
    const rows = readMorphMarketSource(file([fields()]));
    expect(matchMorphMarketSource(rows, [{ id: 'g', gecko_id_code: 'TEST-A', archived: true }])[0].issue).toBe('');
    expect(matchMorphMarketSource(rows, [{ gecko_id_code: 'test-a' }])[0].issue).toContain('No exact');
    expect(matchMorphMarketSource(rows, [{ gecko_id_code: 'TEST-A' }, { gecko_id_code: 'TEST-A' }])[0].issue).toContain('More than one');
  });
  it.each(['Price', 'DOB', 'Weight', 'Private_Notes', 'Photo_Urls'])('refuses to erase %s', key => {
    const source = fields({ [key]: key === 'Photo_Urls' ? 'https://example.com/a.jpg' : 'saved' });
    expect(() => buildPreservedMorphMarketCSV([{ source, draft: { ...source, [key]: '' } }])).toThrow('cannot erase');
  });
  it('blocks identity changes, formula transformations, invalid dates and split quantities', () => {
    const source = fields();
    for (const patch of [{ Animal_ID: 'NEW-ID' }, { Private_Notes: '=1+1' }, { DOB: '2025-02-30' }, { Quantity: '1.1' }, { State: '' }, { Wholesale_Only: 'Yes' }]) {
      expect(morphMarketListingErrors(source, { ...source, ...patch }).length).toBeGreaterThan(0);
    }
    expect(() => buildPreservedMorphMarketCSV([{ source, draft: source }, { source, draft: source }])).toThrow('Duplicate');
  });
  it('carries saved edits forward, flags concurrent changes and settles applied updates', () => {
    const source = fields();
    const saved = { source_fields: source, draft_fields: { ...source, Price: '127' } };
    expect(refreshMorphMarketDraft({ ...source, Private_Notes: 'New note on MM' }, saved)).toMatchObject({ draft: { Price: '127', Private_Notes: 'New note on MM' }, conflicts: [] });
    expect(refreshMorphMarketDraft({ ...source, Price: '130' }, saved).conflicts).toEqual(['Price']);
    const applied = refreshMorphMarketDraft({ ...source, Price: '127' }, saved);
    expect(applied.conflicts).toEqual([]);
    expect(morphMarketChanges({ ...source, Price: '127' }, applied.draft)).toEqual([]);
  });
  it('never suggests private collection notes or invented missing values', () => {
    expect(geckoListingSuggestions({ notes: 'secret', sex: 'Unknown' })).toEqual({});
    expect(geckoListingSuggestions({ asking_price: 175, weight_grams: 20, marketplace_description: 'Public' })).toEqual({ Price: '175', Weight: '20', Desc: 'Public' });
  });
  it('keeps production downloads blocked pending live preservation proof', () => {
    expect(() => exportPreservedMorphMarketCSV([{ source: fields(), draft: fields() }], { loadedAt: Date.now(), reviewed: true })).toThrow('paused');
  });
});
