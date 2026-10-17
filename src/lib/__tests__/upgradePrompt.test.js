import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

import { captureEvent } from '@/lib/posthog';
import {
  lastUpgradePrompt,
  noteUpgradePromptFromLocation,
  openUpgradePlans,
  upgradeMembershipPath,
  upgradePromptClicked,
} from '../activation';

function memoryStore() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
  };
}

beforeEach(() => {
  captureEvent.mockClear();
});

describe('upgrade prompt path', () => {
  it('puts the paywall on the Membership URL', () => {
    const path = upgradeMembershipPath('morph_id', 'morph_id_locked');
    const params = new URLSearchParams(path.split('?')[1]);
    expect(path.startsWith('/Membership?')).toBe(true);
    expect(params.get('from_prompt')).toBe('morph_id_locked');
    expect(params.get('limit_type')).toBe('morph_id');
    expect(params.get('surface')).toBe('morph_id_locked');
  });

  it('records the click through captureEvent and remembers the surface', () => {
    const store = memoryStore();
    const now = Date.UTC(2026, 9, 14, 12);
    vi.spyOn(Date, 'now').mockReturnValue(now);
    upgradePromptClicked('geckos', 'plan_limit_geckos', store);
    expect(captureEvent).toHaveBeenCalledWith('upgrade_prompt_clicked', {
      limit_type: 'geckos',
      surface: 'plan_limit_geckos',
    });
    expect(lastUpgradePrompt(now, store)).toBe('plan_limit_geckos');
    vi.restoreAllMocks();
  });

  it('opens Membership with the query when a navigate function is passed', () => {
    const store = memoryStore();
    const navigate = vi.fn();
    const path = openUpgradePlans('morph_id', 'morph_id_exhausted', navigate, store);
    expect(navigate).toHaveBeenCalledWith(path);
    expect(path).toContain('from_prompt=morph_id_exhausted');
    expect(captureEvent).toHaveBeenCalledWith('upgrade_prompt_clicked', {
      limit_type: 'morph_id',
      surface: 'morph_id_exhausted',
    });
  });

  it('counts a Membership landing once when the button handler did not run', () => {
    const store = memoryStore();
    const search = upgradeMembershipPath('geckos', 'plan_limit_geckos').split('?')[1];
    expect(noteUpgradePromptFromLocation(search, Date.now(), store)).toBe(true);
    expect(noteUpgradePromptFromLocation(search, Date.now(), store)).toBe(false);
    expect(captureEvent).toHaveBeenCalledTimes(1);
  });

  it('does not count the landing again after the button already recorded the click', () => {
    const store = memoryStore();
    upgradePromptClicked('morph_id', 'morph_id_locked', store);
    captureEvent.mockClear();
    const search = '?from_prompt=morph_id_locked&limit_type=morph_id&surface=morph_id_locked';
    expect(noteUpgradePromptFromLocation(search, Date.now(), store)).toBe(false);
    expect(captureEvent).not.toHaveBeenCalled();
  });
});
