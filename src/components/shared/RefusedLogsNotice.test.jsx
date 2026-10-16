// Field Mode lists the logs made offline that the server would not save.
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.window = globalThis.window || { self: null, top: null, addEventListener() {}, removeEventListener() {} };
});

import RefusedLogsNotice, { refusedLogReason, refusedLogText } from './RefusedLogsNotice';

const textOf = (node) => (typeof node === 'string' ? node : (node.children || []).map(textOf).join(''));

describe('refused log wording', () => {
  it('names the log, the gecko and the day', () => {
    expect(refusedLogText({ kind: 'weight', grams: 42, date: '2026-10-14' }, 'Alder')).toBe('Weigh-in (42 g) for Alder on Oct 14');
    expect(refusedLogText({ kind: 'fed', accepted: false, date: '2026-10-03' }, 'Mango')).toBe('Feeding (food refused) for Mango on Oct 3');
    expect(refusedLogText({ kind: 'shed' })).toBe('Shed');
    expect(refusedLogText({ entity: 'Gecko', grams: 33 }, 'Kiwi')).toBe('Weight update (33 g) for Kiwi');
    expect(refusedLogText({})).toBe('Log');
  });

  it('gives a plain reason and never the database text', () => {
    expect(refusedLogReason({ error: { code: '42501', message: 'new row violates row-level security policy' } })).toBe('You can no longer log for this gecko.');
    const other = refusedLogReason({ error: { code: '23503', message: 'insert or update violates foreign key' } });
    expect(other).toMatch(/would not save it/);
    expect(other).not.toMatch(/foreign key/);
    expect(refusedLogReason(null)).toMatch(/would not save it/);
  });
});

describe('RefusedLogsNotice', () => {
  it('shows nothing when no log was refused', async () => {
    let tree;
    await act(async () => { tree = create(<RefusedLogsNotice refused={[]} />); });
    expect(tree.toJSON()).toBeNull();
    await act(async () => { tree.update(<RefusedLogsNotice refused={undefined} />); });
    expect(tree.toJSON()).toBeNull();
  });

  it('lists each refused log by gecko name and dismisses them all', async () => {
    const onDismiss = vi.fn();
    const refused = [
      { id: 'q1', kind: 'weight', geckoId: 'g1', grams: 41, date: '2026-10-14', error: { code: '42501' } },
      { id: 'q2', kind: 'fed', geckoId: 'gone', date: '2026-10-14', error: {} },
    ];
    let tree;
    await act(async () => {
      tree = create(<RefusedLogsNotice refused={refused} geckos={[{ id: 'g1', name: 'Alder' }]} onDismiss={onDismiss} />);
    });
    const text = textOf(tree.root);
    expect(text).toContain('2 logs made offline were not saved');
    expect(text).toContain('Weigh-in (41 g) for Alder on Oct 14');
    // A gecko that is no longer in the collection is not named.
    expect(text).toContain('Feeding on Oct 14');
    // Two different reasons: each log carries its own.
    expect(text).toContain('Weigh-in (41 g) for Alder on Oct 14. You can no longer log for this gecko.');
    expect(text).toMatch(/Feeding on Oct 14\. The server would not save it/);
    const button = tree.root.findAll((n) => n.type === 'button' && textOf(n).trim() === 'Got it')[0];
    await act(async () => { button.props.onClick(); });
    expect(onDismiss).toHaveBeenCalledWith(['q1', 'q2']);
  });

  // A rack fed offline and refused as one batch must not fill the phone
  // screen: Field Mode's gecko list and the fixed footer have to stay usable.
  it('names three refused logs, counts the rest and keeps "Got it" in the title row', async () => {
    const onDismiss = vi.fn();
    const refused = Array.from({ length: 20 }, (_, i) => ({
      id: `q${i}`, kind: 'fed', geckoId: `g${i}`, date: '2026-10-14', error: { code: '42501' },
    }));
    const geckos = refused.map((r, i) => ({ id: r.geckoId, name: `Gecko ${i}` }));
    let tree;
    await act(async () => {
      tree = create(<RefusedLogsNotice refused={refused} geckos={geckos} onDismiss={onDismiss} />);
    });
    const text = textOf(tree.root);
    expect(text).toContain('20 logs made offline were not saved');
    expect(tree.root.findAllByType('li')).toHaveLength(3);
    expect(text).toContain('Feeding for Gecko 0 on Oct 14');
    expect(text).toContain('Feeding for Gecko 2 on Oct 14');
    expect(text).not.toContain('Gecko 3 ');
    expect(text).toContain('and 17 more');
    // One shared cause is said once, not under every gecko.
    expect(text.split('You can no longer log for this gecko.')).toHaveLength(2);

    // The button sits in the title row, before the list, so it never ends
    // up below the screen or under Field Mode's footer.
    const outer = tree.toJSON();
    expect(outer.props.className).toContain('flex-shrink-0');
    expect(outer.props.className).toContain('max-h-[40vh]');
    const [titleRow, listArea] = outer.children;
    expect(textOf(titleRow)).toContain('Got it');
    expect(listArea.props.className).toContain('overflow-y-auto');
    expect(textOf(listArea)).not.toContain('Got it');

    const button = tree.root.findAll((n) => n.type === 'button' && textOf(n).trim() === 'Got it')[0];
    await act(async () => { button.props.onClick(); });
    // "Got it" clears every refusal, including the ones not named.
    expect(onDismiss).toHaveBeenCalledWith(refused.map((r) => r.id));
  });

  it('says nothing about more when three or fewer were refused', async () => {
    const refused = [1, 2, 3].map((n) => ({ id: `q${n}`, kind: 'shed', error: {} }));
    let tree;
    await act(async () => { tree = create(<RefusedLogsNotice refused={refused} />); });
    expect(tree.root.findAllByType('li')).toHaveLength(3);
    expect(textOf(tree.root)).not.toContain('more');
  });
});
