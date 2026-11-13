// @vitest-environment jsdom
// The Weekly Gecko Notes switch in Settings saves on its own call
// (User.setWeeklyNotes) and is never one of the fields the Settings page
// saves as they change, so no save from that page, or from a Settings tab
// left open from before the switch existed, can ever write the column.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ saves: [], fail: null, toasts: [] }));

vi.mock('@/entities/all', () => ({
  User: {
    setWeeklyNotes: async (enabled) => {
      fx.saves.push(enabled);
      if (fx.fail) throw fx.fail;
      return enabled;
    },
  },
}));
vi.mock('@/components/ui/use-toast', () => ({ toast: (t) => fx.toasts.push(t) }));

import WeeklyNotesSetting from '@/components/settings/WeeklyNotesSetting';

installDomHarness();

// The page holds the value; this stands in for it.
function Host({ initial = true }) {
  const [on, setOn] = useState(initial);
  return <WeeklyNotesSetting enabled={on} onChange={setOn} />;
}

beforeEach(() => {
  fx.saves = [];
  fx.fail = null;
  fx.toasts = [];
});

describe('the Weekly Gecko Notes switch', () => {
  it('shows the description and the member\'s current choice', () => {
    render(<Host initial={false} />);
    expect(screen.getByText('Weekly Gecko Notes')).toBeTruthy();
    expect(screen.getByText('One short crested gecko tip a week, starting after your first two weeks. Turning it off keeps your reminders and other emails.')).toBeTruthy();
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  });

  it('each toggle saves at once through its own call', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole('switch'));
    expect(fx.saves).toEqual([false]);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
    expect(fx.toasts.at(-1).title).toBe('Weekly Gecko Notes off');
    await user.click(screen.getByRole('switch'));
    expect(fx.saves).toEqual([false, true]);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('a failed save puts the switch back and says so', async () => {
    const user = userEvent.setup();
    fx.fail = Object.assign(new Error('network down'), { code: 'X' });
    render(<Host />);
    await user.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
    expect(fx.toasts.at(-1)).toMatchObject({ title: 'Could not save', variant: 'destructive' });
  });

  it('before the column exists (PGRST204) it says "Not available yet"', async () => {
    const user = userEvent.setup();
    fx.fail = Object.assign(new Error("Could not find the 'email_weekly_notes_enabled' column"), { code: 'PGRST204' });
    render(<Host />);
    await user.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
    expect(fx.toasts.at(-1)).toMatchObject({ title: 'Not available yet', variant: 'destructive' });
  });
});

describe('Settings never puts the column in the form', () => {
  // Read from the repo root: under jsdom, import.meta.url is not a file URL.
  const SETTINGS = readFileSync(resolve(process.cwd(), 'src/pages/Settings.jsx'), 'utf8');
  const block = (start, end) => {
    const from = SETTINGS.indexOf(start);
    const to = SETTINGS.indexOf(end, from);
    expect(from, start).toBeGreaterThan(-1);
    expect(to, end).toBeGreaterThan(from);
    return SETTINGS.slice(from, to);
  };

  it('not in the defaults, the load mapping or the old preference list', () => {
    const defaults = block('const initialFormData = {', '\n};');
    const mapping = block('loadSaved({', '});');
    const prefs = block('const notificationTypes = [', '];');
    for (const text of [defaults, mapping, prefs]) {
      expect(text).not.toMatch(/weekly/i);
    }
  });

  it('reads the profile value into its own state and hands the switch that state', () => {
    expect(SETTINGS).toContain('setWeeklyNotesEnabled(currentUser.email_weekly_notes_enabled !== false);');
    expect(SETTINGS).toContain('<WeeklyNotesSetting enabled={weeklyNotesEnabled} onChange={setWeeklyNotesEnabled} />');
    // The only mentions of the column are that one read.
    expect(SETTINGS.match(/email_weekly_notes_enabled/g)).toHaveLength(1);
  });

  it('a save sends one changed field of the form, which has no weekly key', () => {
    // The only write the page makes for its form: the field that changed.
    expect(SETTINGS).toContain('save: (patch) => User.updateMyUserData(patch),');
    expect(SETTINGS.match(/User\.updateMyUserData\(/g)).toHaveLength(1);
    // There is no whole-form save left to carry a stale value.
    expect(SETTINGS).not.toContain('updateMyUserData(formData)');
  });

  it('saving with all email off shows the weekly switch off, as the database trigger left it', () => {
    const saved = block('onSaved: (field, value) => {', '\n        },');
    expect(saved).toContain("if (field === 'email_notifications_enabled' && value === false) setWeeklyNotesEnabled(false);");
  });
});
