import { describe, expect, it } from 'vitest';
import {
  buildVisualEvidence,
  evidenceAssessment,
} from '../../../supabase/functions/_shared/morph-evidence.ts';
import {
  meanNormalizedEmbeddings,
  normalizeEmbedding,
} from '../../../supabase/functions/_shared/visual-embedding.ts';

function neighbor(overrides = {}) {
  return {
    id: overrides.id || crypto.randomUUID(),
    image_url: overrides.image_url || 'https://example.com/gecko.jpg',
    primary_morph: overrides.primary_morph || 'harlequin',
    genetic_traits: [],
    secondary_traits: [],
    base_color: 'red',
    similarity: 0.8,
    label_weight: 0.4,
    label_source: 'auto_bulk_approved',
    source_cluster: overrides.source_cluster || crypto.randomUUID(),
    ...overrides,
  };
}

describe('buildVisualEvidence', () => {
  it('de-duplicates listing clusters and balances examples per morph', () => {
    const evidence = buildVisualEvidence([
      neighbor({ id: 'h1', source_cluster: 'listing-a' }),
      neighbor({ id: 'h2', source_cluster: 'listing-a', similarity: 0.79 }),
      neighbor({ id: 'h3', source_cluster: 'listing-b', similarity: 0.78 }),
      neighbor({ id: 'h4', source_cluster: 'listing-c', similarity: 0.77 }),
      neighbor({ id: 'd1', primary_morph: 'dalmatian', source_cluster: 'listing-d', similarity: 0.76 }),
    ], {
      model: 'test-model',
      photoCount: 1,
      maxPerMorph: 2,
    });

    expect(evidence.status).toBe('available');
    expect(evidence.neighbors.map((item) => item.id)).toEqual(['h1', 'h3', 'd1']);
    expect(evidence.neighbors.filter((item) => item.primary_morph === 'harlequin')).toHaveLength(2);
  });

  it('lets one strong-provenance label outweigh multiple weak scraper rows', () => {
    const evidence = buildVisualEvidence([
      neighbor({ id: 'expert', primary_morph: 'tiger', label_weight: 0.95, source_cluster: 'expert-a' }),
      neighbor({ id: 'scrape-1', primary_morph: 'brindle', label_weight: 0.4, source_cluster: 'listing-a' }),
      neighbor({ id: 'scrape-2', primary_morph: 'brindle', label_weight: 0.4, source_cluster: 'listing-b' }),
    ], { model: 'test-model', photoCount: 1 });

    expect(evidence.consensus.primary_morph).toBe('tiger');
    expect(evidence.consensus.source_diversity).toBe(1);
  });

  it('returns no_matches below the similarity floor', () => {
    const evidence = buildVisualEvidence([
      neighbor({ similarity: 0.2 }),
    ], { model: 'test-model', photoCount: 1, minSimilarity: 0.5 });

    expect(evidence.status).toBe('no_matches');
    expect(evidence.consensus).toBeNull();
  });
});

describe('evidenceAssessment', () => {
  const usablePhoto = {
    subject_is_crested_gecko: true,
    usable_for_id: true,
    quality_grade: 'good',
  };

  it('downgrades a confident model call when strong retrieval conflicts', () => {
    const evidence = buildVisualEvidence([
      neighbor({ id: 'd1', primary_morph: 'dalmatian', label_weight: 0.95, source_cluster: 'a' }),
      neighbor({ id: 'd2', primary_morph: 'dalmatian', label_weight: 0.95, source_cluster: 'b', similarity: 0.79 }),
      neighbor({ id: 'h1', primary_morph: 'harlequin', label_weight: 0.4, source_cluster: 'c', similarity: 0.7 }),
    ], { model: 'test-model', photoCount: 1 });

    expect(evidenceAssessment('harlequin', 90, 30, usablePhoto, evidence)).toEqual({
      status: 'tentative',
      conflict: true,
    });
  });

  it('allows a best match when independent evidence supports the model', () => {
    const evidence = buildVisualEvidence([
      neighbor({ id: 'h1', label_weight: 0.95, source_cluster: 'a' }),
      neighbor({ id: 'h2', label_weight: 0.85, source_cluster: 'b', similarity: 0.79 }),
    ], { model: 'test-model', photoCount: 2 });

    expect(evidenceAssessment('harlequin', 86, 18, usablePhoto, evidence)).toEqual({
      status: 'best_match',
      conflict: false,
    });
  });
});

describe('visual embedding utilities', () => {
  it('normalizes and averages photo embeddings', () => {
    expect(normalizeEmbedding([3, 4])).toEqual([0.6, 0.8]);
    const mean = meanNormalizedEmbeddings([[1, 0], [0, 1]]);
    expect(mean[0]).toBeCloseTo(Math.SQRT1_2);
    expect(mean[1]).toBeCloseTo(Math.SQRT1_2);
  });
});
