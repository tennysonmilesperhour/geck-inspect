import { describe, it, expect } from 'vitest';
import { inferHiddenHets } from '../hetInference.js';

// Small pedigree builder. Each animal is { id, morph_tags, sire_id, dam_id }
// and the ancestry list mirrors what buildAncestry returns.
function animal(id, morph_tags = [], { sire, dam } = {}) {
  return { id, morph_tags, sire_id: sire ?? null, dam_id: dam ?? null };
}
function ancestry(...entries) {
  return entries.map(([gecko, depth, relation]) => ({ gecko, depth, relation }));
}
function oddsFor(results, traitName) {
  return results.find((r) => r.traitName === traitName)?.probability ?? 0;
}

describe('inferHiddenHets: one parent', () => {
  it('Het sire x normal dam: the sire passes the allele half the time, so 1/2', () => {
    const sire = animal('s', ['Het Axanthic']);
    const dam = animal('d', ['Harlequin']);
    const subject = animal('x', ['Harlequin'], { sire: 's', dam: 'd' });
    const out = inferHiddenHets(subject, ancestry([sire, 1, 'Sire'], [dam, 1, 'Dam']));
    expect(oddsFor(out, 'Axanthic')).toBeCloseTo(0.5, 10);
    expect(out[0].basis).toEqual(['Sire tagged Het Axanthic']);
  });

  it('Visual sire x normal dam: every baby gets one copy, so 1', () => {
    const sire = animal('s', ['Axanthic']);
    const subject = animal('x', [], { sire: 's' });
    const out = inferHiddenHets(subject, ancestry([sire, 1, 'Sire']));
    expect(oddsFor(out, 'Axanthic')).toBeCloseTo(1, 10);
  });

  it('"66% Het Axanthic" sire x normal: 0.66 x 1/2 = 0.33', () => {
    const sire = animal('s', ['66% Het Axanthic']);
    const subject = animal('x', [], { sire: 's' });
    const out = inferHiddenHets(subject, ancestry([sire, 1, 'Sire']));
    expect(oddsFor(out, 'Axanthic')).toBeCloseTo(0.33, 10);
    expect(out[0].basis).toEqual(['Sire tagged 66% Het Axanthic']);
  });
});

describe('inferHiddenHets: conditioning on the subject not being visual', () => {
  it('Het x Het, normal-looking baby: 1/2 of 3/4 non-visual babies are het, so 2/3 (not 3/4)', () => {
    const sire = animal('s', ['Het Axanthic']);
    const dam = animal('d', ['Het Axanthic']);
    const subject = animal('x', ['Dalmatian'], { sire: 's', dam: 'd' });
    const out = inferHiddenHets(subject, ancestry([sire, 1, 'Sire'], [dam, 1, 'Dam']));
    expect(oddsFor(out, 'Axanthic')).toBeCloseTo(2 / 3, 10);
  });

  it('Het x Possible Het: P(visual) = 1/2 x 1/4 = 1/8, P(het) = 1/2 x 3/4 + 1/2 x 1/4 = 1/2, so (1/2) / (7/8) = 4/7', () => {
    const sire = animal('s', ['Het Axanthic']);
    const dam = animal('d', ['Possible Het Axanthic']);
    const subject = animal('x', [], { sire: 's', dam: 'd' });
    const out = inferHiddenHets(subject, ancestry([sire, 1, 'Sire'], [dam, 1, 'Dam']));
    expect(oddsFor(out, 'Axanthic')).toBeCloseTo(4 / 7, 10);
  });

  it('Visual sire x Het dam, normal-looking baby: a non-visual baby must have one copy, so 1', () => {
    const sire = animal('s', ['Axanthic']);
    const dam = animal('d', ['Het Axanthic']);
    const subject = animal('x', [], { sire: 's', dam: 'd' });
    const out = inferHiddenHets(subject, ancestry([sire, 1, 'Sire'], [dam, 1, 'Dam']));
    expect(oddsFor(out, 'Axanthic')).toBeCloseTo(1, 10);
  });

  it('Visual x Visual parents but subject not tagged visual: tags disagree, still certainly a carrier', () => {
    const sire = animal('s', ['Axanthic']);
    const dam = animal('d', ['Axanthic']);
    const subject = animal('x', [], { sire: 's', dam: 'd' });
    const out = inferHiddenHets(subject, ancestry([sire, 1, 'Sire'], [dam, 1, 'Dam']));
    expect(oddsFor(out, 'Axanthic')).toBe(1);
  });

  it('skips a trait the subject already shows', () => {
    const sire = animal('s', ['Het Axanthic']);
    const subject = animal('x', ['Axanthic'], { sire: 's' });
    const out = inferHiddenHets(subject, ancestry([sire, 1, 'Sire']));
    expect(oddsFor(out, 'Axanthic')).toBe(0);
  });
});

describe('inferHiddenHets: no double counting of one path', () => {
  it('Het sire whose own dam is visual: the tag already explains the grandparent, so 1/2 (old model said 3/4)', () => {
    const grandDam = animal('gd', ['Axanthic']);
    const sire = animal('s', ['Het Axanthic'], { dam: 'gd' });
    const subject = animal('x', [], { sire: 's' });
    const out = inferHiddenHets(
      subject,
      ancestry([sire, 1, 'Sire'], [grandDam, 2, "Sire's dam"]),
    );
    expect(oddsFor(out, 'Axanthic')).toBeCloseTo(0.5, 10);
    expect(out[0].basis).toEqual(['Sire tagged Het Axanthic']);
  });

  it('Possible Het sire whose dam is visual: the parent proves he is het (1), stronger than the tag (1/2), so 1/2', () => {
    const grandDam = animal('gd', ['Axanthic']);
    const sire = animal('s', ['Possible Het Axanthic'], { dam: 'gd' });
    const subject = animal('x', [], { sire: 's' });
    const out = inferHiddenHets(
      subject,
      ancestry([sire, 1, 'Sire'], [grandDam, 2, "Sire's dam"]),
    );
    expect(oddsFor(out, 'Axanthic')).toBeCloseTo(0.5, 10);
    expect(out[0].basis).toEqual(["Sire's dam is visual Axanthic"]);
  });

  it('Possible Het sire out of a Het grandparent: the tag (1/2) beats the pedigree (1/2 x 1/2 = 1/4), so 1/2 x 1/2 = 1/4', () => {
    const grandSire = animal('gs', ['Het Axanthic']);
    const sire = animal('s', ['Possible Het Axanthic'], { sire: 'gs' });
    const subject = animal('x', [], { sire: 's' });
    const out = inferHiddenHets(
      subject,
      ancestry([sire, 1, 'Sire'], [grandSire, 2, "Sire's sire"]),
    );
    expect(oddsFor(out, 'Axanthic')).toBeCloseTo(0.25, 10);
  });
});

describe('inferHiddenHets: deeper generations', () => {
  it('Untagged sire out of a visual grandparent: the sire is a certain het, so 1/2', () => {
    const grandDam = animal('gd', ['Axanthic']);
    const sire = animal('s', [], { dam: 'gd' });
    const subject = animal('x', [], { sire: 's' });
    const out = inferHiddenHets(
      subject,
      ancestry([sire, 1, 'Sire'], [grandDam, 2, "Sire's dam"]),
    );
    expect(oddsFor(out, 'Axanthic')).toBeCloseTo(0.5, 10);
  });

  it('Sire tagged with other traits (seen, not Axanthic) out of Het x Het: sire is 2/3 het, passes it half the time, so 1/3', () => {
    const gs = animal('gs', ['Het Axanthic']);
    const gd = animal('gd', ['Het Axanthic']);
    const sire = animal('s', ['Harlequin'], { sire: 'gs', dam: 'gd' });
    const subject = animal('x', [], { sire: 's' });
    const out = inferHiddenHets(
      subject,
      ancestry([sire, 1, 'Sire'], [gs, 2, "Sire's sire"], [gd, 2, "Sire's dam"]),
    );
    expect(oddsFor(out, 'Axanthic')).toBeCloseTo(1 / 3, 10);
  });

  it('Sire with no tags at all out of Het x Het: his look is unknown, so he passes the allele 1/4 + 1/2 x 1/2 = 1/2 of the time', () => {
    const gs = animal('gs', ['Het Axanthic']);
    const gd = animal('gd', ['Het Axanthic']);
    const sire = animal('s', [], { sire: 'gs', dam: 'gd' });
    const subject = animal('x', [], { sire: 's' });
    const out = inferHiddenHets(
      subject,
      ancestry([sire, 1, 'Sire'], [gs, 2, "Sire's sire"], [gd, 2, "Sire's dam"]),
    );
    expect(oddsFor(out, 'Axanthic')).toBeCloseTo(0.5, 10);
  });

  it('Het great-grandparent through untagged animals: 1/2 x 1/2 x 1/2 = 1/8, above the 10% floor', () => {
    const ggs = animal('ggs', ['Het Phantom']);
    const gs = animal('gs', [], { sire: 'ggs' });
    const sire = animal('s', [], { sire: 'gs' });
    const subject = animal('x', [], { sire: 's' });
    const out = inferHiddenHets(
      subject,
      ancestry([sire, 1, 'Sire'], [gs, 2, "Sire's sire"], [ggs, 3, "Sire's sire's sire"]),
    );
    expect(oddsFor(out, 'Phantom')).toBeCloseTo(0.125, 10);
  });

  it('Possible Het great-grandparent: 1/2 x 1/8 = 1/16, below the 10% floor, so not shown', () => {
    const ggs = animal('ggs', ['Possible Het Phantom']);
    const gs = animal('gs', [], { sire: 'ggs' });
    const sire = animal('s', [], { sire: 'gs' });
    const subject = animal('x', [], { sire: 's' });
    const out = inferHiddenHets(
      subject,
      ancestry([sire, 1, 'Sire'], [gs, 2, "Sire's sire"], [ggs, 3, "Sire's sire's sire"]),
    );
    expect(oddsFor(out, 'Phantom')).toBe(0);
  });

  it('falls back to relation labels when records carry no parent ids (Het x Het gives 2/3)', () => {
    const out = inferHiddenHets(
      { morph_tags: [] },
      [
        { gecko: { morph_tags: ['Het Axanthic'] }, depth: 1, relation: 'Sire' },
        { gecko: { morph_tags: ['Het Axanthic'] }, depth: 1, relation: 'Dam' },
      ],
    );
    expect(oddsFor(out, 'Axanthic')).toBeCloseTo(2 / 3, 10);
  });

  it('does not hang on a pedigree that loops back on itself', () => {
    const a = animal('a', ['Het Axanthic'], { sire: 'b' });
    const b = animal('b', [], { sire: 'a' });
    const sire = animal('s', [], { sire: 'b' });
    const subject = animal('x', [], { sire: 's' });
    const out = inferHiddenHets(
      subject,
      ancestry([sire, 1, 'Sire'], [b, 2, "Sire's sire"], [a, 3, "Sire's sire's sire"]),
    );
    // a's Het tag settles a (the loop back to b is never followed), so b
    // is 1/2 het and passes 1/4; the sire is 1/4 het and the subject 1/8.
    expect(oddsFor(out, 'Axanthic')).toBeCloseTo(0.125, 10);
  });
});

describe('inferHiddenHets: incomplete dominants', () => {
  it('never invents a hidden het from a visual Lilly White parent', () => {
    const sire = animal('s', ['Lilly White']);
    const subject = animal('x', [], { sire: 's' });
    const out = inferHiddenHets(subject, ancestry([sire, 1, 'Sire']));
    expect(oddsFor(out, 'Lilly White')).toBe(0);
  });

  it('honours an explicit Possible Het Lilly White parent: 1/2 x 1/2 = 1/4, no "not visual" step', () => {
    const sire = animal('s', ['Possible Het Lilly White']);
    const subject = animal('x', [], { sire: 's' });
    const out = inferHiddenHets(subject, ancestry([sire, 1, 'Sire']));
    expect(oddsFor(out, 'Lilly White')).toBeCloseTo(0.25, 10);
  });
});
