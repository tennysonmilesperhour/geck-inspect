import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkAcceptedFacts } from '../../../scripts/lib/accepted-facts.mjs';

const problemsIn = (text, only) => {
  const found = [];
  checkAcceptedFacts(text, (msg) => found.push(msg), only ? { only } : undefined);
  return found;
};

// Sentences that really shipped before October 2026 (or the same mistake
// in other words). Each must be caught by its rule.
const WRONG = [
  ['lillyWhiteOrigin', 'Lilly White was discovered by Anthony Caponetto at ACR in 2014 and named after his daughter.'],
  ['lillyWhiteOrigin', 'Lilly White was discovered by Anthony Caponetto at AC Reptiles (ACR) in 2014.'],
  ['lillyWhiteOrigin', 'Lilly White first appeared in 2014 at a UK breeder.'],
  ['superLillyWhite', 'Super Lilly White is healthy and can be bred like any other gecko.'],
  ['superCappuccino', 'Lethal alleles are common in incomplete-dominant morphs across reptile hobbies, Super Cinnamon ball pythons, Super Cappuccino crested geckos.'],
  ['superCappuccino', 'Super Cappuccino is lethal, so never pair two Cappuccinos.'],
  ['superHighway', 'The main evidence is that Super Highway hatchlings show nostril and health issues like Super Cappuccino.'],
  ['superHighway', 'Super Highway has documented complications similar to other allelic-complex supers and nostril issues.'],
  ['superHighway', 'Highway × Highway → 25% Super Highway (health concerns), 50% Highway, 25% normal'],
  ['cappuccinoOrigin', 'Cappuccino was discovered by Pangea in 2015.'],
  ['albinoStatus', 'Albino is now a proven recessive trait in crested geckos.'],
  ['femaleBreedingMinimum', 'Do not breed a female under about 35 to 40 g and 18 months old.'],
  ['incubationDays', 'Incubate at cool room temperature (about 70 to 74 F). Eggs hatch in roughly 60 to 90 days.'],
  ['incubationDays', 'At 78 to 82°F the eggs hatch in 45 to 60 days.'],
  // The old care guide wrote the range with an en dash (U+2013).
  ['lifeStages', `Hatchling (0${String.fromCharCode(0x2013)}8 g) gets fresh food daily.`],
  ['lifeStages', 'Hatchlings <12g: small critter keeper or 6qt tub.'],
  ['lifeStages', 'Adults 25g+: 18×18×24 minimum.'],
  ['adultWeight', 'Healthy adults weigh about 30 to 55 g.'],
  ['shedIntervals', 'Crested geckos shed every 1 to 4 weeks depending on age and growth rate.'],
  ['shedIntervals', 'Adults shed every 4-8 weeks, easy to miss if colors are dark.'],
];

// Correct sentences, including the tricky ones the rules must leave alone.
const RIGHT = [
  'Lilly White traces to Lilly Exotics (Nick Lumb, United Kingdom), starting with an unusual hatchling in late 2010.',
  'AC Reptiles imported and popularised Lilly White, which was first produced by Lilly Exotics in 2010.',
  'Super Lilly White is lethal: embryos die in the egg or within days of hatching.',
  'Super Lilly White dies in the egg, Super Cappuccino has documented severe health problems, and Super Soft Scale is healthy.',
  'There are no living Super Lilly Whites to buy: two copies die before or shortly after hatching.',
  'Super Cappuccino is not confirmed embryonic-lethal the way Super Lilly White is.',
  'Is Super Cappuccino lethal like Super Lilly White?',
  'In crested geckos, Super Lilly White is lethal, while Super Cappuccino usually hatches but has documented health problems.',
  'If Super Cappuccinos are genuinely healthy at population scale, the data will show it over time.',
  'Some breeders report nostril and health problems in Super Highway hatchlings; this is not established.',
  "Super Cappuccino's health problems are documented; Super Highway's are only reported.",
  'It was discovered and proven by Reptile City Korea in 2020-2021.',
  'Albino is expected to be recessive, but that is not yet proven.',
  'Do not breed a female until she is at least 40 g and 18 months old, both.',
  'If you are building a paired breeding project, do not purchase "confirmed female" animals under 12 grams.',
  'Eggs hatch in about 70 to 90 days at 72 to 75°F; 90 to 120 days at 68 to 71°F; 60 to 75 days at 76 to 78°F.',
  'Wide range based on temperature: 60-120 days.',
  'Hatchling (under 3 g) gets fresh food daily.',
  'Your gecko is a hatchling or juvenile under 15g.',
  'Sub-adult (15 to 35 g) and Adult (35 g+).',
  'Adults top out around 35 to 60 grams and live 15 to 20 years.',
  'An adult female, especially one in a breeding program, often reaches 45-55 grams.',
  'Hatchlings shed every 1-2 weeks.',
  'Juveniles shed every 2-3 weeks.',
  'Adults shed every 4-6 weeks.',
];

describe('accepted facts rules', () => {
  it.each(WRONG)('%s catches: %s', (fact, sentence) => {
    const found = problemsIn(sentence);
    expect(found.length, `no rule fired for: ${sentence}`).toBeGreaterThan(0);
    expect(found.some((msg) => msg.includes('Accepted fact:'))).toBe(true);
    // The rule named is among those that fired.
    expect(problemsIn(sentence, [fact]).length).toBeGreaterThan(0);
  });

  it.each(RIGHT)('leaves alone: %s', (sentence) => {
    expect(problemsIn(sentence)).toEqual([]);
  });
});

describe('the consistency check runs inside pnpm build', () => {
  // `pnpm build` runs `pnpm test`, so running the script here means a
  // Vercel deploy fails on a contradiction, not only CI.
  it('passes on the current content', () => {
    const script = fileURLToPath(new URL('../../../scripts/check-genetics-consistency.mjs', import.meta.url));
    let output = '';
    try {
      output = execFileSync(process.execPath, [script], { encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
      throw new Error(`check-genetics-consistency failed:\n${error.stdout || ''}${error.stderr || ''}`);
    }
    expect(output).toContain('all curated surfaces agree');
  }, 60000);
});
