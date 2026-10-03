import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = { geckos: [], eggs: [], logs: [] };
let failGeckoCreate = null;
let failEggUpdate = null;

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/entities/all', () => ({
  Gecko: {
    get: async (id) => db.geckos.find((g) => g.id === id) || null,
    create: async (data) => {
      if (failGeckoCreate) throw failGeckoCreate;
      const row = { id: `g${db.geckos.length + 1}`, ...data };
      db.geckos.push(row);
      return row;
    },
    update: async (id, data) => {
      const row = db.geckos.find((g) => g.id === id);
      Object.assign(row, data);
      return row;
    },
    delete: async (id) => { db.geckos = db.geckos.filter((g) => g.id !== id); },
  },
  Egg: {
    update: async (id, data) => {
      if (failEggUpdate) throw failEggUpdate;
      const row = db.eggs.find((e) => e.id === id);
      Object.assign(row, data);
      return row;
    },
  },
  PairingOutcomeLog: {
    filter: async (q) => db.logs.filter((l) => Object.entries(q).every(([k, v]) => l[k] === v)),
    create: async (data) => { const row = { id: `l${db.logs.length + 1}`, ...data }; db.logs.push(row); return row; },
    update: async (id, data) => {
      const row = db.logs.find((l) => l.id === id);
      Object.assign(row, data);
      return row;
    },
  },
}));

const { hatchEgg, hatchDateProblem, buildHatchlingRecord, defaultHatchlingName } = await import('@/lib/hatchEgg');

const sire = { id: 's1', name: 'Zeus', morph_tags: ['Lilly White'], species: 'Crested Gecko' };
const dam = { id: 'd1', name: 'Tiger', morph_tags: ['Harlequin'] };
const plan = { id: 'p1', sire_id: 's1', dam_id: 'd1', breeding_id: 'ZxT' };

function seedEggs() {
  db.eggs = [
    { id: 'e1', breeding_plan_id: 'p1', lay_date: '2026-06-01', status: 'Incubating' },
    { id: 'e2', breeding_plan_id: 'p1', lay_date: '2026-06-01', status: 'Incubating' },
  ];
}

describe('hatchEgg: one hatch path', () => {
  beforeEach(() => {
    db.geckos = [];
    db.logs = [];
    failGeckoCreate = null;
    failEggUpdate = null;
    seedEggs();
  });

  it('creates the gecko with the chosen hatch date and marks the egg hatched and archived', async () => {
    const egg = db.eggs[0];
    const { gecko } = await hatchEgg({ egg, plan, sire, dam, pairEggs: db.eggs, hatchDate: '2026-08-10' });
    expect(gecko.hatch_date).toBe('2026-08-10');
    expect(gecko.sire_id).toBe('s1');
    expect(gecko.dam_id).toBe('d1');
    expect(gecko.sex).toBe('Unsexed');
    expect(gecko.incubation_days).toBe(70);
    expect(gecko.gecko_id_code).toBe('ZeTi1a26');
    expect(gecko.name).toBe('Zeus x Tiger #1');
    expect(db.eggs[0]).toMatchObject({ status: 'Hatched', hatch_date_actual: '2026-08-10', gecko_id: gecko.id, archived: true });
  });

  it('logs "what hatched" and puts both eggs of a clutch in one log row', async () => {
    const predicted = [{ label: 'Lilly White', probability: 0.5 }, { label: 'Normal', probability: 0.5 }];
    await hatchEgg({ egg: db.eggs[0], plan, sire, dam, pairEggs: db.eggs, hatchDate: '2026-08-10', observed: 'Lilly White', predicted });
    await hatchEgg({ egg: db.eggs[1], plan, sire, dam, pairEggs: db.eggs, hatchDate: '2026-08-11', observed: 'Normal', predicted });
    expect(db.logs).toHaveLength(1);
    expect(db.logs[0]).toMatchObject({ pairing_key: 's1|d1', observed: ['Lilly White', 'Normal'], eggs: 2, hatched_on: '2026-08-11' });
    expect(db.logs[0].predicted).toEqual(predicted);
  });

  it('writes no outcome log when nothing was chosen', async () => {
    await hatchEgg({ egg: db.eggs[0], plan, sire, dam, pairEggs: db.eggs, hatchDate: '2026-08-10' });
    expect(db.logs).toHaveLength(0);
  });

  it('leaves the egg incubating when the gecko limit refuses the hatchling', async () => {
    failGeckoCreate = { message: 'The Free plan holds up to 10 active geckos.', hint: 'gecko_limit_reached' };
    await expect(hatchEgg({ egg: db.eggs[0], plan, sire, dam, pairEggs: db.eggs, hatchDate: '2026-08-10' }))
      .rejects.toMatchObject({ hint: 'gecko_limit_reached' });
    expect(db.eggs[0].status).toBe('Incubating');
    expect(db.geckos).toHaveLength(0);
  });

  it('removes the new gecko again when the egg cannot be saved', async () => {
    failEggUpdate = new Error('network');
    await expect(hatchEgg({ egg: db.eggs[0], plan, sire, dam, pairEggs: db.eggs, hatchDate: '2026-08-10' })).rejects.toThrow('network');
    expect(db.geckos).toHaveLength(0);
  });

  it('reuses the linked gecko when an egg is hatched a second time', async () => {
    const { gecko } = await hatchEgg({ egg: db.eggs[0], plan, sire, dam, pairEggs: db.eggs, hatchDate: '2026-08-10' });
    Object.assign(db.eggs[0], { status: 'Incubating', archived: false, hatch_date_actual: null });
    const again = await hatchEgg({ egg: db.eggs[0], plan, sire, dam, pairEggs: db.eggs, hatchDate: '2026-08-12' });
    expect(again.gecko.id).toBe(gecko.id);
    expect(db.geckos).toHaveLength(1);
    expect(db.geckos[0].hatch_date).toBe('2026-08-12');
  });

  it('retries with a suffix when the ID code is already used', async () => {
    let calls = 0;
    failGeckoCreate = null;
    const original = (await import('@/entities/all')).Gecko.create;
    const { Gecko } = await import('@/entities/all');
    Gecko.create = async (data) => {
      calls += 1;
      if (calls === 1) throw { code: '23505', message: 'This animal ID is already used in your collection.' };
      return original(data);
    };
    const { gecko } = await hatchEgg({ egg: db.eggs[0], plan, sire, dam, pairEggs: db.eggs, hatchDate: '2026-08-10' });
    expect(gecko.gecko_id_code).toBe('ZeTi1a26-b');
    Gecko.create = original;
  });
});

describe('hatch date checks', () => {
  const egg = { lay_date: '2026-06-01' };
  it('needs a date', () => expect(hatchDateProblem('', egg, '2026-08-10')).toMatch(/Choose/));
  it('refuses the future', () => expect(hatchDateProblem('2026-08-11', egg, '2026-08-10')).toMatch(/future/));
  it('refuses a date before the lay date', () => expect(hatchDateProblem('2026-05-30', egg, '2026-08-10')).toMatch(/before/));
  it('accepts a normal date', () => expect(hatchDateProblem('2026-08-01', egg, '2026-08-10')).toBeNull());
});

describe('egg status changes', () => {
  it('archives a failed egg and un-archives one set back to Incubating', async () => {
    const { eggStatusFields } = await import('@/lib/hatchEgg');
    expect(eggStatusFields('Stillbirth', '2026-08-10')).toEqual({ status: 'Stillbirth', archived: true, archived_date: '2026-08-10' });
    expect(eggStatusFields('Incubating')).toEqual({ status: 'Incubating', archived: false, archived_date: null, hatch_date_actual: null });
    expect(() => eggStatusFields('Hatched')).toThrow();
  });
});

describe('hatchling record', () => {
  it('numbers the default name after the hatchlings the pair already has', () => {
    const pairEggs = [{ status: 'Hatched', gecko_id: 'x' }, { status: 'Hatched', gecko_id: 'y' }, { status: 'Incubating' }];
    expect(defaultHatchlingName(sire, dam, pairEggs)).toBe('Zeus x Tiger #3');
  });
  it('keeps a typed name and takes the species from a parent', () => {
    const rec = buildHatchlingRecord({ egg: { id: 'e1', lay_date: '2026-06-01' }, plan, sire, dam, pairEggs: [], hatchDate: '2026-08-10', name: ' Biscuit ' });
    expect(rec.name).toBe('Biscuit');
    expect(rec.species).toBe('Crested Gecko');
  });
});
