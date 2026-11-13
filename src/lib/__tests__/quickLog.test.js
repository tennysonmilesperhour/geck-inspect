import { describe, expect, it } from 'vitest';
import {
  isBigWeightChange,
  latestWeights,
  parseGrams,
  parseQuickLogParams,
  pickQuickLogGeckos,
  quickLogLink,
  quickLogPath,
  quickLogReturnTarget,
  quickLogTitle,
  readQuickLog,
} from '@/lib/quickLog';

// What public.care_log_link writes into reminder notifications
// (supabase/tests/logging_regressions.sql checks the same strings).
const SAFE_LINK = /^\/([^/\\\s"'<>`][^\\\s"'<>`]*)?$/;

describe('reading a reminder link', () => {
  it('reads type, geckos and groups', () => {
    expect(parseQuickLogParams('?type=weight&gecko=lg-w1,lg-w2')).toEqual({
      type: 'weight', geckoIds: ['lg-w1', 'lg-w2'], groupIds: [], more: 0, from: null,
    });
    expect(parseQuickLogParams('?type=feeding&gecko=g1&group=grp-1')).toMatchObject({
      type: 'feeding', geckoIds: ['g1'], groupIds: ['grp-1'],
    });
  });

  it('drops unsafe or repeated ids and keeps at most 10', () => {
    const ids = Array.from({ length: 14 }, (_, i) => `g${i}`).join(',');
    expect(parseQuickLogParams(`?gecko=${ids}`).geckoIds).toHaveLength(10);
    expect(parseQuickLogParams('?gecko=a,a,b%20c,<x>,../y,ok_1').geckoIds).toEqual(['a', 'ok_1']);
  });

  it('reads how many geckos the reminder left out of the link', () => {
    expect(parseQuickLogParams('?type=weight&gecko=g1&more=190').more).toBe(190);
    expect(parseQuickLogParams('?gecko=g1&more=0').more).toBe(0);
    expect(parseQuickLogParams('?gecko=g1&more=-3').more).toBe(0);
    expect(parseQuickLogParams('?gecko=g1&more=4x').more).toBe(0);
    expect(parseQuickLogParams('?gecko=g1&more=99999999').more).toBe(0);
  });

  it('falls back to feeding for an unknown type and accepts Field Mode\'s "fed"', () => {
    expect(parseQuickLogParams('?type=surprise').type).toBe('feeding');
    expect(parseQuickLogParams('?type=fed').type).toBe('feeding');
    expect(parseQuickLogParams('?type=SHED').type).toBe('shed');
  });

  it('only returns to a page inside the app, never another site or /log', () => {
    expect(parseQuickLogParams('?from=/Dashboard').from).toBe('/Dashboard');
    expect(parseQuickLogParams('?from=/MyGeckos?gecko=abc').from).toBe('/MyGeckos?gecko=abc');
    expect(parseQuickLogParams('?from=//evil.example').from).toBeNull();
    expect(parseQuickLogParams('?from=https://evil.example').from).toBeNull();
    expect(parseQuickLogParams('?from=/log?type=weight').from).toBeNull();
  });
});

describe('building a link', () => {
  it('matches the reminder job and passes the notification link rule', () => {
    const link = quickLogPath({ type: 'feeding', geckoIds: ['g1', 'g2'], groupIds: ['grp-1'] });
    expect(link).toBe('/log?type=feeding&gecko=g1,g2&group=grp-1');
    expect(SAFE_LINK.test(link)).toBe(true);
    const back = quickLogPath({ type: 'weight', geckoIds: ['g1'], from: '/Dashboard' });
    expect(back).toBe('/log?type=weight&gecko=g1&from=%2FDashboard');
    expect(parseQuickLogParams(back.slice(4)).from).toBe('/Dashboard');
  });

  it('says how many geckos did not fit in the link', () => {
    const ids = Array.from({ length: 13 }, (_, i) => `g${i}`);
    const link = quickLogPath({ type: 'weight', geckoIds: ids });
    expect(link).toBe('/log?type=weight&gecko=g0,g1,g2,g3,g4,g5,g6,g7,g8,g9&more=3');
    expect(SAFE_LINK.test(link)).toBe(true);
    expect(parseQuickLogParams(link.slice(4)).more).toBe(3);
  });
});

// Experience review E3: the 10-id cap is for links that travel in an
// email or a notification. Inside the app the list goes in router state.
describe('a link from inside the app', () => {
  const many = Array.from({ length: 23 }, (_, i) => `g${i}`);

  it('carries the whole list in state, however long', () => {
    const link = quickLogLink({ type: 'feeding', geckoIds: many, groupIds: ['grp-1'], from: '/Today' });
    expect(link.state.quickLog.geckoIds).toEqual(many);
    expect(link.state.quickLog.groupIds).toEqual(['grp-1']);
    // Too many for the address: no ids there, and never "more".
    expect(link.to).toBe('/log?type=feeding&from=%2FToday');
    expect(SAFE_LINK.test(link.to)).toBe(true);
    const read = readQuickLog(link.to.slice(4), link.state);
    expect(read).toMatchObject({ type: 'feeding', scope: 'named', inApp: true, more: 0, from: '/Today' });
    expect(read.geckoIds).toEqual(many);
  });

  it('keeps a short list in the address too, so a reload shows the same geckos', () => {
    const link = quickLogLink({ type: 'weight', geckoIds: ['g1', 'g2'], from: '/Today' });
    expect(link.to).toBe('/log?type=weight&gecko=g1,g2&from=%2FToday');
    expect(readQuickLog(link.to.slice(4), null).geckoIds).toEqual(['g1', 'g2']);
  });

  it('marks a whole-collection list with all=1 when it does not fit, and with no geckos at all', () => {
    expect(quickLogLink({ type: 'shed', geckoIds: many, all: true }).to).toBe('/log?type=shed&all=1');
    expect(quickLogLink({ type: 'feeding', all: true })).toEqual({ to: '/log?type=feeding&all=1', state: null });
    expect(quickLogLink({ type: 'feeding' })).toEqual({ to: '/log?type=feeding', state: null });
  });

  it('drops unsafe and repeated ids from state as it does from an address', () => {
    const read = readQuickLog('?type=weight', { quickLog: { geckoIds: ['a', 'a', '<x>', 'b c', 'ok_1'], groupIds: 'nope' } });
    expect(read.geckoIds).toEqual(['a', 'ok_1']);
    expect(read.groupIds).toEqual([]);
  });
});

describe('what the log page is asked for', () => {
  it('a reminder link names its geckos, capped at 10, and may say how many were left out', () => {
    const ids = Array.from({ length: 14 }, (_, i) => `g${i}`).join(',');
    const read = readQuickLog(`?type=weight&gecko=${ids}&more=4`);
    expect(read.scope).toBe('named');
    expect(read.inApp).toBe(false);
    expect(read.geckoIds).toHaveLength(10);
    expect(read.more).toBe(4);
  });

  it('no ids means everything due, and all=1 means every active gecko', () => {
    expect(readQuickLog('?type=feeding')).toMatchObject({ scope: 'due', inApp: true, geckoIds: [], more: 0 });
    expect(readQuickLog('?type=weight&all=1&from=/MyGeckos')).toMatchObject({ scope: 'all', type: 'weight', from: '/MyGeckos' });
    // An empty list in state is no list.
    expect(readQuickLog('?type=feeding', { quickLog: { geckoIds: [], groupIds: [] } }).scope).toBe('due');
  });
});

describe('weights', () => {
  it('reads what was typed, with a comma or a point, to one decimal', () => {
    expect(parseGrams('18.5')).toBe(18.5);
    expect(parseGrams(' 18,54 ')).toBe(18.5);
    expect(parseGrams('')).toBeNull();
    expect(parseGrams('abc')).toBeNull();
    expect(parseGrams('0')).toBeNull();
    expect(parseGrams('500')).toBeNull();
  });

  it('asks again only when an entry is more than 30 percent from the last weight', () => {
    expect(isBigWeightChange(151, 15.1)).toBe(true);
    expect(isBigWeightChange(1.5, 15.1)).toBe(true);
    expect(isBigWeightChange(19.6, 15.1)).toBe(false);
    expect(isBigWeightChange(10.6, 15.1)).toBe(false);
    expect(isBigWeightChange(10.5, 15.1)).toBe(true);
    // No earlier weight: nothing to compare with.
    expect(isBigWeightChange(151, null)).toBe(false);
    expect(isBigWeightChange(151, undefined)).toBe(false);
    expect(isBigWeightChange(151, 0)).toBe(false);
  });

  it('finds each gecko\'s newest weigh-in', () => {
    const latest = latestWeights([
      { gecko_id: 'g1', weight_grams: 14.2, record_date: '2026-09-25' },
      { gecko_id: 'g1', weight_grams: '15.1', record_date: '2026-10-25' },
      { gecko_id: 'g2', weight_grams: 40, record_date: '2026-10-01' },
      { gecko_id: 'g3', weight_grams: null, record_date: '2026-10-02' },
    ]);
    expect(latest.get('g1')).toEqual({ grams: 15.1, date: '2026-10-25' });
    expect(latest.get('g2')).toEqual({ grams: 40, date: '2026-10-01' });
    expect(latest.has('g3')).toBe(false);
  });
});

describe('picking the geckos', () => {
  const geckos = [
    { id: 'g1', name: 'Mango', feeding_group_id: 'grp' },
    { id: 'g2', name: 'Kiwi', feeding_group_id: 'grp' },
    { id: 'g3', name: 'Alder', feeding_group_id: 'grp' },
    { id: 'g4', name: 'Archived', feeding_group_id: 'grp', archived: true },
    { id: 'g5', name: 'Solo', feeding_group_id: null },
  ];

  it('lists named geckos in link order and counts the missing', () => {
    const out = pickQuickLogGeckos({ geckos, geckoIds: ['g5', 'gone', 'g1'] });
    expect(out.listed.map((g) => g.id)).toEqual(['g5', 'g1']);
    expect(out.missing).toBe(1);
  });

  it('lists a group\'s active geckos once, by name', () => {
    const out = pickQuickLogGeckos({ geckos, geckoIds: ['g1'], groupIds: ['grp', 'empty'] });
    expect(out.groups[0].geckos.map((g) => g.name)).toEqual(['Alder', 'Kiwi']);
    expect(out.groups[1]).toEqual({ id: 'empty', geckos: [] });
  });
});

describe('going back', () => {
  it('uses from, then the previous page, then the Dashboard', () => {
    expect(quickLogReturnTarget({ from: '/MyGeckos', historyIndex: 3 })).toBe('/MyGeckos');
    expect(quickLogReturnTarget({ historyIndex: 2 })).toBe(-1);
    expect(quickLogReturnTarget({ historyIndex: 0 })).toBe('/Dashboard');
  });

  it('titles the page by type', () => {
    expect(quickLogTitle('weight')).toBe('Log a weigh-in');
    expect(quickLogTitle('shed')).toBe('Log a shed');
    expect(quickLogTitle('feeding')).toBe('Log a feeding');
  });
});
