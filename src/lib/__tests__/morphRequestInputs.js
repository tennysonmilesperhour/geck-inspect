// Fixed inputs for the Morph ID request snapshot (morphRequestSnapshot.test.js).
// The snapshot in __fixtures__/morphRequestSnapshot.json was taken from the
// request recognize-gecko-morph built on 17 Oct 2026, before the latency work
// in docs/planning (warm-up, overlap, time budget). It must not change unless
// the prediction instructions are meant to change, which needs a graded run.
import { buildVisualEvidence } from '../../../supabase/functions/_shared/morph-evidence.ts';

const RAW_NEIGHBORS = [
  { id: 'n1', image_url: 'https://ref.example.com/n1.webp', primary_morph: 'harlequin', genetic_traits: ['lilly_white'], secondary_traits: ['white_fringe'], base_color: 'red', similarity: 0.83, label_weight: 0.9, label_source: 'geck-data-scraper', source_cluster: 'seller:a' },
  { id: 'n2', image_url: 'https://ref.example.com/n2.webp', primary_morph: 'extreme_harlequin', genetic_traits: [], secondary_traits: ['portholes'], base_color: 'dark_red', similarity: 0.79, label_weight: 0.95, label_source: 'expert_owner', source_cluster: 'seller:b' },
  { id: 'n3', image_url: 'https://ref.example.com/n3.webp', primary_morph: 'pinstripe', genetic_traits: [], secondary_traits: [], base_color: null, similarity: 0.74, label_weight: 0.9, label_source: 'geck-data-scraper', source_cluster: 'seller:c' },
  { id: 'n4', image_url: 'https://ref.example.com/n4.webp', primary_morph: 'harlequin', genetic_traits: [], secondary_traits: ['tricolor'], base_color: 'orange', similarity: 0.71, label_weight: 0.6, label_source: 'community', source_cluster: 'seller:d' },
  { id: 'n5', image_url: 'https://ref.example.com/n5.webp', primary_morph: 'tricolor', genetic_traits: [], secondary_traits: [], base_color: 'dark', similarity: 0.66, label_weight: 0.9, label_source: 'geck-data-scraper', source_cluster: 'seller:e' },
];

export const SNAPSHOT_CASES = [
  {
    name: 'two photos, three neighbors',
    imageUrls: ['https://storage.example.com/top.webp', 'https://storage.example.com/side.webp'],
    includeValueEstimate: false,
    model: 'claude-sonnet-4-6',
    context: { ageStage: 'juvenile', firedState: 'fired_up' },
    visualEvidence: buildVisualEvidence(RAW_NEIGHBORS, {
      model: 'krthr/clip-embeddings',
      photoCount: 1,
      minSimilarity: 0.5,
      maxNeighbors: 8,
      maxPerMorph: 2,
      rankingDepth: 16,
    }),
  },
  {
    name: 'one photo, retrieval unavailable',
    imageUrls: ['https://storage.example.com/only.webp'],
    includeValueEstimate: false,
    model: 'claude-sonnet-4-6',
    context: { ageStage: 'unknown', firedState: 'unknown' },
    visualEvidence: {
      status: 'unavailable',
      model: 'krthr/clip-embeddings',
      photo_count: 0,
      neighbors: [],
      consensus: null,
      note: 'Replicate 429: throttled',
    },
  },
  {
    name: 'newer model that rejects a forced tool',
    imageUrls: ['https://storage.example.com/top.webp', 'https://storage.example.com/side.webp', 'https://storage.example.com/extra.webp'],
    includeValueEstimate: false,
    model: 'claude-sonnet-5-5',
    context: { ageStage: 'adult', firedState: 'fired_down' },
    visualEvidence: {
      status: 'no_matches',
      model: 'krthr/clip-embeddings',
      photo_count: 1,
      neighbors: [],
      consensus: null,
    },
  },
];
