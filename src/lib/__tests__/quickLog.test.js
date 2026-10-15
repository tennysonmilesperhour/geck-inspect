import { describe, expect, it } from 'vitest';
import {
  parseQuickLogParams,
  pickQuickLogGeckos,
  quickLogPath,
  quickLogReturnTarget,
  quickLogTitle,
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
