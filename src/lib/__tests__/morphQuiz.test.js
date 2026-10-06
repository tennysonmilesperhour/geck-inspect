import { describe, expect, it } from 'vitest';
import { MORPHS } from '@/data/morph-guide';
import { COMBO_RULES, QUIZ_STEPS, RULES, quizComplete, scoreMorphs } from '@/lib/morphQuiz';

const SLUGS = new Set(MORPHS.map((m) => m.slug));
const base = { pattern: 'none', lines: 'no', spots: 'none', unusual: 'none' };
const top = (answers) => scoreMorphs({ ...base, ...answers }).map((r) => r.slug);

describe('morphQuiz rule table', () => {
  it('only uses slugs that exist in the morph guide', () => {
    for (const step of Object.values(RULES)) {
      for (const rule of Object.values(step)) {
        for (const slug of Object.keys(rule.points)) expect(SLUGS.has(slug), slug).toBe(true);
      }
    }
    for (const combo of COMBO_RULES) {
      for (const slug of Object.keys(combo.points)) expect(SLUGS.has(slug), slug).toBe(true);
    }
  });

  it('has a rule for every option of every step', () => {
    for (const step of QUIZ_STEPS) {
      for (const opt of step.options) expect(RULES[step.id][opt.id], `${step.id}.${opt.id}`).toBeTruthy();
    }
  });
});

describe('scoreMorphs', () => {
  it('names the obvious morphs first', () => {
    expect(top({ pattern: 'sides' })[0]).toBe('harlequin');
    expect(top({ pattern: 'everywhere' })[0]).toBe('extreme-harlequin');
    expect(top({ pattern: 'back' })[0]).toBe('flame');
    expect(top({ pattern: 'sides', lines: 'full' })[0]).toBe('pinstripe');
    expect(top({ pattern: 'none', lines: 'full' })[0]).toBe('phantom-pinstripe');
    expect(top({ pattern: 'none', spots: 'lots' })).toContain('super-dalmatian');
    expect(top({ pattern: 'back', spots: 'some' })).toContain('dalmatian');
    expect(top({ pattern: 'none', spots: 'red' })).toContain('dalmatian');
    expect(top({ pattern: 'none' })).toEqual(['patternless']);
  });

  it('lets a strong single trait win', () => {
    expect(top({ pattern: 'sides', unusual: 'red-eyes' })[0]).toBe('albino');
    expect(top({ pattern: 'sides', unusual: 'gray' })[0]).toBe('axanthic');
    expect(top({ pattern: 'none', unusual: 'pale' })).toEqual(
      expect.arrayContaining(['lilly-white', 'moonglow']),
    );
  });

  it('returns one to three real morphs with a reason, for every answer combination', () => {
    const combos = QUIZ_STEPS.reduce(
      (acc, step) => acc.flatMap((a) => step.options.map((o) => ({ ...a, [step.id]: o.id }))),
      [{}],
    );
    expect(combos.length).toBe(4 * 3 * 4 * 4);
    for (const answers of combos) {
      const res = scoreMorphs(answers);
      expect(res.length).toBeGreaterThanOrEqual(1);
      expect(res.length).toBeLessThanOrEqual(3);
      for (const r of res) {
        expect(SLUGS.has(r.slug)).toBe(true);
        expect(r.reason).toMatch(/^You said .+\.$/);
        expect(r.reason).not.toMatch(/[\u2013\u2014]/);
      }
      expect(new Set(res.map((r) => r.slug)).size).toBe(res.length);
    }
  });

  it('handles empty answers', () => {
    expect(scoreMorphs({})).toEqual([]);
    expect(quizComplete({})).toBe(false);
    expect(quizComplete(base)).toBe(true);
  });
});
