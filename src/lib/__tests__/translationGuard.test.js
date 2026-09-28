import { describe, expect, it, vi } from 'vitest';
import { installTranslationGuard } from '../translationGuard';

function fakeDom() {
  const removeChild = vi.fn(function (child) { child.parentNode = null; return child; });
  const insertBefore = vi.fn(function (node) { node.parentNode = this; return node; });
  const proto = { removeChild, insertBefore };
  const makeNode = () => Object.create(proto);
  return { proto, removeChild, insertBefore, makeNode };
}

describe('installTranslationGuard', () => {
  it('skips removing a node the translator already moved instead of throwing', () => {
    const { proto, removeChild, makeNode } = fakeDom();
    installTranslationGuard(proto);
    const parent = makeNode();
    const elsewhere = makeNode();
    const child = makeNode();
    child.parentNode = elsewhere;

    expect(parent.removeChild(child)).toBe(child);
    expect(removeChild).not.toHaveBeenCalled();
  });

  it('still removes and inserts normally when the page is not translated', () => {
    const { proto, removeChild, insertBefore, makeNode } = fakeDom();
    installTranslationGuard(proto);
    const parent = makeNode();
    const child = makeNode();
    child.parentNode = parent;
    const reference = makeNode();
    reference.parentNode = parent;
    const fresh = makeNode();

    parent.removeChild(child);
    parent.insertBefore(fresh, reference);
    parent.insertBefore(makeNode(), null);

    expect(removeChild).toHaveBeenCalledTimes(1);
    expect(insertBefore).toHaveBeenCalledTimes(2);
  });

  it('skips inserting before a reference node that has a different parent', () => {
    const { proto, insertBefore, makeNode } = fakeDom();
    installTranslationGuard(proto);
    const parent = makeNode();
    const reference = makeNode();
    reference.parentNode = makeNode();
    const fresh = makeNode();

    expect(parent.insertBefore(fresh, reference)).toBe(fresh);
    expect(insertBefore).not.toHaveBeenCalled();
  });

  it('installs only once', () => {
    const { proto } = fakeDom();
    expect(installTranslationGuard(proto)).toBe(true);
    expect(installTranslationGuard(proto)).toBe(false);
  });
});
