import { describe, expect, it } from 'vitest';
import { orderedViewUrls, viewsReady } from '../photoViews';

const ready = (url) => ({ id: url, url, status: 'ready' });

describe('photo views', () => {
  it('needs both a top and a side view', () => {
    expect(viewsReady({ top: ready('t'), side: null, extras: [] })).toBe(false);
    expect(viewsReady({ top: null, side: ready('s'), extras: [ready('x')] })).toBe(false);
    expect(viewsReady({ top: ready('t'), side: { id: 's', url: null, status: 'pending' }, extras: [] })).toBe(false);
    expect(viewsReady({ top: ready('t'), side: ready('s'), extras: [] })).toBe(true);
  });

  it('sends the top view first, then the side view, then the extras', () => {
    const slots = {
      top: ready('top.jpg'),
      side: ready('side.jpg'),
      extras: [ready('fired.jpg'), { id: 'up', url: null, status: 'pending' }, { id: 'bad', url: null, status: 'failed' }],
    };
    expect(orderedViewUrls(slots)).toEqual(['top.jpg', 'side.jpg', 'fired.jpg']);
  });
});
