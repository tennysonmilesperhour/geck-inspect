// The Morph ID result panel: no "82/100" scores, never the model's own
// dollar guess, and Price Index asking prices (with listing counts) only
// for a member who turned them on.
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { buildTraitValueIndex } from '@/lib/traitValuation';

const index = buildTraitValueIndex([
  { trait: 'Harlequin', aliases: ['harlequin'], age_class: 'any', sex_class: 'any', n: 410, p25: 90, p50: 150, p75: 250 },
]);

vi.mock('@/lib/traitValueTable', () => ({ loadTraitValueIndex: vi.fn(async () => index) }));
vi.mock('@/entities/all', () => ({ User: { me: vi.fn() } }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/morph-id/persistence', () => ({ saveGeckoImageWithMeta: vi.fn() }));
// The shared UI pieces need a browser; plain stand-ins keep the words.
const Pass = ({ children }) => <div>{children}</div>;
vi.mock('@/components/ui/card', () => ({ Card: Pass, CardContent: Pass, CardHeader: Pass, CardTitle: Pass }));
vi.mock('@/components/ui/badge', () => ({ Badge: Pass }));
vi.mock('@/components/ui/button', () => ({ Button: ({ children }) => <button type="button">{children}</button> }));
vi.mock('@/components/ui/label', () => ({ Label: Pass }));
vi.mock('@/components/ui/textarea', () => ({ Textarea: () => <textarea /> }));
vi.mock('@/components/ui/select', () => ({ Select: Pass, SelectContent: Pass, SelectItem: Pass, SelectTrigger: Pass, SelectValue: () => null }));
vi.mock('../MorphPicker', () => ({ default: () => null }));
vi.mock('../TraitPicker', () => ({ default: () => null }));
vi.mock('../ConfidenceSlider', () => ({ default: () => null }));
vi.mock('react-router-dom', () => ({ Link: ({ children, to }) => <a href={to}>{children}</a> }));

const { default: MorphCorrectionPanel } = await import('../MorphCorrectionPanel');

const RESULT = {
  primary_morph: 'harlequin',
  genetic_traits: [],
  assessment_status: 'tentative',
  confidence_score: 82,
  model_signal: 82,
  candidate_morphs: [
    { morph: 'harlequin', score: 82, why: 'Heavy lateral pattern' },
    { morph: 'tricolor', score: 45, why: 'Some red' },
  ],
  photo_observations: [
    { photo_number: 1, view: 'top_down', quality_grade: 'good', contributes_to_result: true, evidence_signal: 75, visible_features: [], limitations: [] },
  ],
  // What an older server sent: the model's own price guess.
  value_estimate: { usd_low: 300, usd_high: 900, notes: 'clean pin lifts this' },
  evidence_markers: [],
  photo_assessment: {},
};

const textOf = (node) => (typeof node === 'string' ? node : Array.isArray(node) ? node.map(textOf).join('') : node?.children?.map(textOf).join('') || '');

async function render(props) {
  let tree;
  await act(async () => {
    tree = create(
      <MorphCorrectionPanel result={RESULT} imageUrl="https://img.test/a.jpg" imageUrls={['https://img.test/a.jpg']} {...props} />,
    );
  });
  // Let the price index promise settle.
  await act(async () => {});
  return textOf(tree.toJSON());
}

describe('MorphCorrectionPanel', () => {
  it('shows scores as the AI own estimate in words, never as x/100', async () => {
    const text = await render();
    expect(text).not.toMatch(/\d+\/100/);
    expect(text).toContain("AI's own estimate: close fit");
    expect(text).toContain("AI's own estimate: partial fit");
    expect(text).toContain('own estimate: clear evidence');
    expect(text).toMatch(/not a measured accuracy/);
  });

  it('never shows the model guessed retail range', async () => {
    const text = await render({ showPriceRange: true });
    expect(text).not.toMatch(/Estimated retail range/);
    expect(text).not.toContain('$300');
    expect(text).not.toContain('clean pin lifts this');
  });

  it('shows Price Index asking prices with their listing count when turned on', async () => {
    const text = await render({ showPriceRange: true, ageStage: 'unknown' });
    expect(text).toContain('Asking prices in the Price Index');
    expect(text).toContain('$90 to $250');
    expect(text).toContain('Middle half of 410 listings, all ages');
  });

  it('shows no prices for a member who has not turned them on', async () => {
    const text = await render({ showPriceRange: false });
    expect(text).not.toContain('Asking prices in the Price Index');
  });
});
