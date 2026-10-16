import { describe, it, expect } from 'vitest';
import { STEP_BLURBS } from '../tutorial-steps';
import { RETIRED_PAGES } from '@/lib/retiredPages';
import { NAV_GROUPS } from '@/lib/navItems';

// The walkthrough must not promise features that were retired
// (audit step 32, and review item E3 23 on 16 Oct 2026): shipping, Q&A,
// the Morph Visualizer, Breeding Loans, mentorship, giveaways, Promote,
// other reptiles, the AI Consultant and the supplies store.
const RETIRED = [
  /shipping/i, /\bQ&A\b/i, /visualizer/i, /\bloans?\b/i, /mentor/i, /giveaway/i,
  /\bpromot(e|ion)\b/i, /other reptiles/i, /consultant/i, /supplies/i,
];

describe('tutorial steps', () => {
  it('never mentions retired features', () => {
    for (const [page, { title, body }] of Object.entries(STEP_BLURBS)) {
      for (const re of RETIRED) {
        expect(`${page}: ${title} ${body}`).not.toMatch(re);
      }
    }
  });

  it('has no step for a retired page', () => {
    for (const { page } of RETIRED_PAGES) expect(STEP_BLURBS[page], page).toBeUndefined();
  });

  it('covers every sidebar page and group', () => {
    for (const group of NAV_GROUPS) {
      expect(STEP_BLURBS[`__group_${group.id}`], group.id).toBeTruthy();
      for (const page of group.pages) expect(STEP_BLURBS[page], page).toBeTruthy();
    }
  });

  it('uses no em or en dashes', () => {
    expect(JSON.stringify(STEP_BLURBS)).not.toMatch(/[\u2013\u2014]/);
  });
});
