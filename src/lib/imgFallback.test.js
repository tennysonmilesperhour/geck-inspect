import { describe, it, expect } from 'vitest';
import { swapToFallback } from './imgFallback';

function fakeImg(src) {
  const attrs = { src };
  return {
    dataset: {},
    getAttribute: (k) => attrs[k],
    set src(v) { attrs.src = v; this.sets += 1; },
    get src() { return attrs.src; },
    sets: 0,
  };
}

describe('swapToFallback', () => {
  it('swaps to the fallback once', () => {
    const img = fakeImg('https://cdn.example/broken.png');
    swapToFallback({ currentTarget: img }, '/logo.png');
    expect(img.src).toBe('/logo.png');
    expect(img.sets).toBe(1);
  });

  it('does not loop when the fallback also fails', () => {
    const img = fakeImg('https://cdn.example/broken.png');
    for (let i = 0; i < 5; i += 1) swapToFallback({ currentTarget: img }, '/logo.png');
    expect(img.sets).toBe(1);
  });

  it('does nothing when the broken image already is the fallback', () => {
    const img = fakeImg('/logo.png');
    swapToFallback({ currentTarget: img }, '/logo.png');
    swapToFallback({ currentTarget: img }, '/logo.png');
    expect(img.sets).toBe(0);
  });
});
