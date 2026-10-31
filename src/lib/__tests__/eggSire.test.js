import { describe, it, expect } from 'vitest';
import {
  applyClutchSire, clutchEggs, clutchSireFields, earlierPairings, effectiveSireId,
  isMissingSireColumnError, lastContactDate, unconfirmedSireNote, withUnconfirmedSireNote,
} from '@/lib/eggSire';

// Tiger was paired with Atlas last season, then with Zeus this season.
const plan = { id: 'p2', sire_id: 'zeus', dam_id: 'tiger', pairing_date: '2026-03-01' };
const earlier = {
  id: 'p1', sire_id: 'atlas', dam_id: 'tiger', pairing_date: '2025-04-01',
  copulation_events: [{ date: '2025-05-10' }, { date: '2025-06-20' }],
};

describe('effective sire', () => {
  it('is the plan\'s sire for every egg recorded before (no sire of its own)', () => {
    expect(effectiveSireId({ id: 'e1' }, plan)).toBe('zeus');
  });
  it('is the egg\'s own sire when it has one', () => {
    expect(effectiveSireId({ id: 'e1', sire_id: 'atlas' }, plan)).toBe('atlas');
  });
});

describe('earlier pairings', () => {
  it('takes the last copulation as the last contact', () => {
    expect(lastContactDate(earlier)).toBe('2025-06-20');
  });

  it('lists the dam\'s other male and marks him recent within the retention window', () => {
    const list = earlierPairings({ plan, damPlans: [plan, earlier], layDate: '2026-04-15' });
    expect(list).toEqual([{ sireId: 'atlas', planId: 'p1', contactDate: '2025-06-20', recent: true }]);
  });

  it('is not recent more than a year after the last contact', () => {
    const [p] = earlierPairings({ plan, damPlans: [earlier], layDate: '2026-08-01' });
    expect(p.recent).toBe(false);
  });

  it('leaves out the same male, other dams and pairings that started after the eggs', () => {
    const sameMale = { id: 'p3', sire_id: 'zeus', dam_id: 'tiger', pairing_date: '2025-01-01' };
    const otherDam = { id: 'p4', sire_id: 'ares', dam_id: 'luna', pairing_date: '2026-01-01' };
    const later = { id: 'p5', sire_id: 'hermes', dam_id: 'tiger', pairing_date: '2026-09-01' };
    const list = earlierPairings({ plan, damPlans: [sameMale, otherDam, later, earlier], layDate: '2026-04-15' });
    expect(list.map((p) => p.sireId)).toEqual(['atlas']);
  });
});

describe('clutch values', () => {
  it('stores the plan\'s own sire as empty and drops a possible sire equal to the sire', () => {
    expect(clutchSireFields({ plan, sireId: 'zeus', possibleSireId: 'zeus' })).toEqual({ sire_id: null, possible_sire_id: null });
    expect(clutchSireFields({ plan, sireId: 'atlas', possibleSireId: 'zeus' })).toEqual({ sire_id: 'atlas', possible_sire_id: 'zeus' });
    expect(clutchSireFields({ plan, sireId: null, possibleSireId: 'atlas' })).toEqual({ sire_id: null, possible_sire_id: 'atlas' });
  });

  it('finds the clutch: same plan, same lay date', () => {
    const eggs = [
      { id: 'a', breeding_plan_id: 'p2', lay_date: '2026-04-15' },
      { id: 'b', breeding_plan_id: 'p2', lay_date: '2026-04-15T00:00:00' },
      { id: 'c', breeding_plan_id: 'p2', lay_date: '2026-05-20' },
    ];
    expect(clutchEggs(eggs[0], eggs).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('replaces the unconfirmed line in genetics notes', () => {
    const line = unconfirmedSireNote('Zeus', 'Atlas');
    expect(line).toBe('Sire not confirmed: Zeus or Atlas. The dam was paired with both, and a female can store sperm for months.');
    const notes = withUnconfirmedSireNote('Het Axanthic\nSire not confirmed: old line.', line);
    expect(notes).toBe(`Het Axanthic\n${line}`);
    expect(withUnconfirmedSireNote(notes, null)).toBe('Het Axanthic');
  });

  it('recognises a missing column error only for the sire columns', () => {
    expect(isMissingSireColumnError({ code: 'PGRST204', message: "Could not find the 'sire_id' column of 'eggs'" })).toBe(true);
    expect(isMissingSireColumnError({ code: 'PGRST204', message: "Could not find the 'grade' column" })).toBe(false);
  });
});

describe('applyClutchSire', () => {
  function fakeDb() {
    const db = {
      eggs: [
        { id: 'a', breeding_plan_id: 'p2', lay_date: '2026-04-15', status: 'Hatched', gecko_id: 'h1' },
        { id: 'b', breeding_plan_id: 'p2', lay_date: '2026-04-15', status: 'Incubating' },
        { id: 'c', breeding_plan_id: 'p2', lay_date: '2026-05-20', status: 'Incubating' },
        { id: 'd', breeding_plan_id: 'p2', lay_date: '2026-04-15', status: 'Hatched', gecko_id: 'gone' },
      ],
      geckos: [{ id: 'h1', sire_id: 'zeus', dam_id: 'tiger', genetics_notes: 'Het Axanthic' }],
    };
    const deps = {
      Egg: { update: async (id, data) => Object.assign(db.eggs.find((e) => e.id === id), data) },
      Gecko: {
        get: async (id) => db.geckos.find((g) => g.id === id) || null,
        update: async (id, data) => Object.assign(db.geckos.find((g) => g.id === id), data),
      },
    };
    return { db, deps };
  }

  it('moves the whole clutch, and its hatchling, to the earlier male', async () => {
    const { db, deps } = fakeDb();
    const result = await applyClutchSire({
      egg: db.eggs[0], plan, pairEggs: db.eggs, sireId: 'atlas', possibleSireId: 'zeus',
      names: { atlas: 'Atlas', zeus: 'Zeus' }, deps,
    });
    expect(db.eggs.filter((e) => e.sire_id === 'atlas').map((e) => e.id)).toEqual(['a', 'b', 'd']);
    expect(db.eggs[2].sire_id).toBeUndefined();
    expect(db.geckos[0].sire_id).toBe('atlas');
    expect(db.geckos[0].genetics_notes).toBe('Het Axanthic\nSire not confirmed: Atlas or Zeus. The dam was paired with both, and a female can store sperm for months.');
    expect(result).toEqual({ eggs: 3, geckos: 1, skipped: 1 });
  });

  it('keeps a sire the member set by hand on the hatchling', async () => {
    const { db, deps } = fakeDb();
    db.geckos[0].sire_id = 'ares';
    await applyClutchSire({ egg: db.eggs[0], plan, pairEggs: db.eggs, sireId: 'atlas', possibleSireId: null, deps });
    expect(db.geckos[0].sire_id).toBe('ares');
    expect(db.geckos[0].genetics_notes).toBe('Het Axanthic');
  });

  it('moves back to the plan\'s sire and clears the line', async () => {
    const { db, deps } = fakeDb();
    await applyClutchSire({ egg: db.eggs[0], plan, pairEggs: db.eggs, sireId: 'atlas', possibleSireId: 'zeus', deps });
    await applyClutchSire({ egg: db.eggs[0], plan, pairEggs: db.eggs, sireId: null, possibleSireId: null, deps });
    expect(db.eggs[0]).toMatchObject({ sire_id: null, possible_sire_id: null });
    expect(db.geckos[0].sire_id).toBe('zeus');
    expect(db.geckos[0].genetics_notes).toBe('Het Axanthic');
  });
});
