import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canCrossFade, crossFade, crossFadeState, flushCrossFade } from '../crossFade';

// A stand-in browser. `startViewTransition` keeps the callback it is
// given, the way a browser does until it has its picture of the old
// screen; the test then plays the browser and calls it.
function browser({ reduced = false, transitions = true } = {}) {
  const callbacks = [];
  const doc = transitions
    ? {
      startViewTransition: vi.fn((callback) => {
        callbacks.push(callback);
        return { ready: Promise.resolve(), finished: Promise.resolve() };
      }),
    }
    : {};
  const win = { matchMedia: (query) => ({ matches: reduced && query.includes('reduce') }) };
  return { doc, win, callbacks };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  flushCrossFade();
  vi.useRealTimers();
});

describe('crossFade', () => {
  it('hands the change to startViewTransition when the browser has it and motion is allowed', () => {
    const { doc, win, callbacks } = browser();
    const update = vi.fn();
    crossFade(update, { doc, win });

    expect(doc.startViewTransition).toHaveBeenCalledTimes(1);
    // The change waits for the browser's picture of the old screen.
    expect(update).not.toHaveBeenCalled();
    callbacks[0]();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('makes the change at once in a browser without view transitions', () => {
    const { doc, win } = browser({ transitions: false });
    const update = vi.fn();
    crossFade(update, { doc, win });
    expect(update).toHaveBeenCalledTimes(1);
    expect(canCrossFade({ doc, win })).toBe(false);
  });

  it('makes the change at once, with no fade, under reduced motion', () => {
    const { doc, win } = browser({ reduced: true });
    const update = vi.fn();
    crossFade(update, { doc, win });
    expect(update).toHaveBeenCalledTimes(1);
    expect(doc.startViewTransition).not.toHaveBeenCalled();
    expect(canCrossFade({ doc, win })).toBe(false);
  });

  it('gives the fade the promise the change returns, so it can wait for the new screen', () => {
    const { doc, win, callbacks } = browser();
    const drawn = Promise.resolve();
    crossFade(() => drawn, { doc, win });
    expect(callbacks[0]()).toBe(drawn);
  });

  it('never leaves a tap waiting: with no frame from the browser the change runs anyway, once', () => {
    const { doc, win, callbacks } = browser();
    const update = vi.fn();
    crossFade(update, { doc, win });
    vi.advanceTimersByTime(149);
    expect(update).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(update).toHaveBeenCalledTimes(1);
    // The browser gets round to it later: nothing runs a second time.
    callbacks[0]();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('a second change made before the picture is taken joins the same fade, in order', () => {
    const { doc, win, callbacks } = browser();
    const order = [];
    crossFade(() => order.push('first'), { doc, win });
    crossFade(() => order.push('second'), { doc, win });
    // One fade, not two: a tab asks twice for one tap (press, then focus).
    expect(doc.startViewTransition).toHaveBeenCalledTimes(1);
    expect(order).toEqual([]);
    callbacks[0]();
    expect(order).toEqual(['first', 'second']);
  });

  it('a change that throws does not stop the one queued behind it', () => {
    const { doc, win, callbacks } = browser();
    const second = vi.fn();
    crossFade(() => { throw new Error('first failed'); }, { doc, win });
    crossFade(second, { doc, win });
    expect(() => callbacks[0]()).toThrow('first failed');
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('a new fade starts once the last one has had its picture', () => {
    const { doc, win, callbacks } = browser();
    crossFade(() => {}, { doc, win });
    callbacks[0]();
    crossFade(() => {}, { doc, win });
    expect(doc.startViewTransition).toHaveBeenCalledTimes(2);
  });

  it('flushCrossFade runs a change that is still waiting for its picture', () => {
    const { doc, win } = browser();
    const update = vi.fn();
    crossFade(update, { doc, win });
    flushCrossFade();
    expect(update).toHaveBeenCalledTimes(1);
    flushCrossFade();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('still makes the change when the browser refuses to start a fade', () => {
    const { win } = browser();
    const doc = { startViewTransition: () => { throw new Error('InvalidStateError'); } };
    const update = vi.fn();
    crossFade(update, { doc, win });
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe('crossFadeState', () => {
  it('applies a state change inside the fade', () => {
    const { doc, win, callbacks } = browser();
    const update = vi.fn();
    crossFadeState(update, { doc, win });
    expect(update).not.toHaveBeenCalled();
    callbacks[0]();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('applies it at once where there is no fade', () => {
    const { doc, win } = browser({ reduced: true });
    const update = vi.fn();
    crossFadeState(update, { doc, win });
    expect(update).toHaveBeenCalledTimes(1);
    expect(doc.startViewTransition).not.toHaveBeenCalled();
  });
});
