import { describe, expect, it, vi } from 'vitest';
import { onSlowConnection, warmPhoneTabs } from '../warmPhoneTabs';

// A stand-in window that keeps the idle callback (or the timer) it is given.
function idleWindow({ idle = true } = {}) {
  const win = { queued: null, cancelled: null };
  if (idle) {
    win.requestIdleCallback = vi.fn((callback, options) => { win.queued = { callback, options }; return 7; });
    win.cancelIdleCallback = vi.fn((id) => { win.cancelled = id; });
  }
  win.setTimeout = vi.fn((callback, ms) => { win.queued = { callback, ms }; return 9; });
  win.clearTimeout = vi.fn((id) => { win.cancelled = id; });
  return win;
}

describe('warmPhoneTabs', () => {
  it('waits for the browser to be idle, then fetches the tab screens once', () => {
    const win = idleWindow();
    const load = vi.fn();
    warmPhoneTabs({ win, nav: {}, load });
    expect(load).not.toHaveBeenCalled();
    expect(win.queued.options).toEqual({ timeout: 4000 });
    win.queued.callback();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('uses a short timer where the browser cannot say when it is idle (Safari)', () => {
    const win = idleWindow({ idle: false });
    const load = vi.fn();
    warmPhoneTabs({ win, nav: {}, load });
    expect(win.queued.ms).toBe(2000);
    win.queued.callback();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('fetches nothing when the phone asked to save data or is on 2G', () => {
    for (const connection of [{ saveData: true }, { effectiveType: '2g' }, { effectiveType: 'slow-2g' }]) {
      const win = idleWindow();
      const load = vi.fn();
      warmPhoneTabs({ win, nav: { connection }, load });
      expect(win.queued).toBeNull();
      expect(onSlowConnection({ connection })).toBe(true);
    }
    expect(onSlowConnection({ connection: { effectiveType: '4g' } })).toBe(false);
    expect(onSlowConnection({})).toBe(false);
  });

  it('the function it returns cancels a fetch that has not started', () => {
    const win = idleWindow();
    warmPhoneTabs({ win, nav: {}, load: vi.fn() })();
    expect(win.cancelled).toBe(7);
    const timerWin = idleWindow({ idle: false });
    warmPhoneTabs({ win: timerWin, nav: {}, load: vi.fn() })();
    expect(timerWin.cancelled).toBe(9);
  });
});
