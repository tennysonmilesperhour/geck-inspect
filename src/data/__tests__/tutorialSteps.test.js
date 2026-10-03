import { describe, it, expect } from 'vitest';
import { STEP_BLURBS } from '../tutorial-steps';

// The walkthrough must not promise features that were retired
// (audit step 32): shipping, Q&A, the Morph Visualizer, Breeding Loans,
// mentorship and giveaways.
const RETIRED = [/shipping/i, /\bQ&A\b/i, /visualizer/i, /\bloans?\b/i, /mentor/i, /giveaway/i];
const RETIRED_PAGES = ['Shipping', 'BreedingLoans', 'Mentorship', 'Giveaways', 'MorphVisualizer', 'CommunityConnect', 'TrainModel'];

describe('tutorial steps', () => {
  it('never mentions retired features', () => {
    for (const [page, { title, body }] of Object.entries(STEP_BLURBS)) {
      for (const re of RETIRED) {
        expect(`${page}: ${title} ${body}`).not.toMatch(re);
      }
    }
  });

  it('has no step for a retired page', () => {
    for (const page of RETIRED_PAGES) expect(STEP_BLURBS[page]).toBeUndefined();
  });

  it('uses no em or en dashes', () => {
    expect(JSON.stringify(STEP_BLURBS)).not.toMatch(/[–—]/);
  });
});
