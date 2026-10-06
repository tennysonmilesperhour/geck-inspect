import { create } from 'react-test-renderer';
import { afterAll, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => vi.stubGlobal('window', { self: null, top: null }));
afterAll(() => vi.unstubAllGlobals());

vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/components/ui/slider', () => ({ Slider: () => null }));
vi.mock('react-router-dom', () => ({ Link: ({ children }) => children }));

import { buildTraitValueIndex } from '@/lib/traitValuation';
import SeasonProjectionPanel from '../breeding/SeasonProjectionPanel';

const band = (trait, age, sex, n, p25, p50, p75) => ({ trait, aliases: [trait.toLowerCase()], age_class: age, sex_class: sex, n, p25, p50, p75 });
const index = buildTraitValueIndex([
  band('Lilly White', 'any', 'any', 600, 250, 375, 600),
  band('Lilly White', 'hatchling', 'unsexed', 80, 200, 300, 450),
  band('Dalmatian', 'any', 'any', 400, 100, 180, 300),
  band('Dalmatian', 'hatchling', 'unsexed', 60, 65, 100, 150),
]);

const PHENOTYPES = [
  { probability: 0.5, visual_traits: [], health_risk: null, matching_combo_morphs: [] },
];

const text = (node) => (typeof node === 'string' ? node : !node ? '' : Array.isArray(node) ? node.map(text).join('') : (node.children || []).map(text).join(''));

describe('SeasonProjectionPanel', () => {
  it('renders the range, the lock for non-Enterprise and the listing advice', () => {
    const tree = create(
      <SeasonProjectionPanel phenotypes={PHENOTYPES} priceIndex={index} seed={3} sellModel={{ allowed: false }} />,
    );
    const out = text(tree.toJSON());
    expect(out).toContain('Likely');
    expect(out).toContain('part of Enterprise');
    expect(out).toContain('When to list');
    tree.unmount();
  });

  it('shows sell times for Enterprise', () => {
    const model = { allowed: true, rate: 0.012, factors: {}, age_medians: {} };
    const tree = create(
      <SeasonProjectionPanel phenotypes={PHENOTYPES} priceIndex={index} seed={3} sellModel={model} />,
    );
    const out = text(tree.toJSON());
    expect(out).toContain('half sell within');
    expect(out).toContain('Half sold');
    tree.unmount();
  });
});
