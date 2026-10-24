import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { format } from 'date-fns';
import { CARE_CATEGORIES } from '@/data/care-guide';
import {
  ADULT_WEIGHT_G,
  BREEDING,
  HATCH_WEIGHT_G,
  HEAT_DANGER_C,
  HEAT_DANGER_F,
  INCUBATION_PROFILES as FACT_PROFILES,
  LIFE_STAGES,
  WEIGH_IN_DAYS,
  shedRhythmSentence,
  stageGainWords,
  stageGrams,
  stageMonths,
  stageWithGrams,
} from '@/data/husbandry-facts';
import { INCUBATION_PROFILES, getEstimatedHatchDates } from '@/lib/incubationProfiles';
import { careStage, lifeStage } from '@/lib/lifeStage';
import { predictNextShed, stageShedWindow } from '@/lib/shedPrediction';
import { growthBandAt } from '@/lib/growthBand';
import { SETUP_GUIDE } from '@/data/keepers-guides/setup';
import { FEEDING_GUIDE } from '@/data/keepers-guides/feeding';
import { HANDBOOK_GUIDE } from '@/data/keepers-guides/handbook';
import { MORPH_GUIDE } from '@/data/keepers-guides/morph';
import { BREEDING_GUIDE } from '@/data/keepers-guides/breeding';
import { BLOG_POSTS } from '@/data/blog-posts';
import { readWeeklyNotes } from '../../../scripts/lib/weekly-notes.mjs';

const category = (id) => CARE_CATEGORIES.find((c) => c.id === id);
const section = (catId, sectionId) => category(catId).sections.find((s) => s.id === sectionId);

describe('one life-stage scale', () => {
  it('the care guide feeding and enclosure tables use the same stages as the Life Stages facts', () => {
    // Before October 2026 the feeding table said hatchlings were 0 to 8 g
    // while Life Stages said 0 to 3 g.
    const feedingRows = section('feeding', 'feeding-schedules').body.find((b) => b.type === 'table').rows;
    expect(feedingRows.slice(0, 4).map((row) => row[0])).toEqual(LIFE_STAGES.map((s) => stageWithGrams(s.id)));
    const housingRows = section('housing', 'enclosure-size').body.find((b) => b.type === 'table').rows;
    expect(housingRows.map((row) => row[1])).toEqual(LIFE_STAGES.map((s) => stageGrams(s.id)));
    const facts = category('life-stages').quickFacts;
    for (const stage of LIFE_STAGES) {
      expect(facts.find((f) => f.label === stage.label).value).toBe(`${stageGrams(stage.id)} · ${stageMonths(stage.id)}`);
    }
  });

  it('the Life Stages section titles name the same weights', () => {
    // Titles stay literal strings (the sitemap script reads them from the
    // file text), so this keeps them in step with the facts.
    const titles = category('life-stages').sections.map((s) => s.title);
    expect(titles).toContain(`Hatchlings (${stageGrams('hatchling')})`);
    expect(titles).toContain(`Juveniles (${stageGrams('juvenile')})`);
    expect(titles).toContain(`Sub-adults (${stageGrams('subadult')})`);
    expect(titles).toContain(`Adults (${stageGrams('adult')})`);
  });

  it('the stage rule: a stage ends at its weight or its age, whichever is later', () => {
    const on = '2026-10-16';
    expect(careStage({ weightGrams: 2, today: on })).toBe('hatchling');
    expect(careStage({ weightGrams: 3, today: on })).toBe('juvenile');
    expect(careStage({ weightGrams: 14.9, today: on })).toBe('juvenile');
    expect(careStage({ weightGrams: 15, today: on })).toBe('subadult');
    expect(careStage({ weightGrams: 35, today: on })).toBe('adult');
    // 20 g but only 10 months old: still a juvenile.
    expect(careStage({ weightGrams: 20, hatchDate: '2025-12-16', today: on })).toBe('juvenile');
    // 10 g at 14 months: still a juvenile by weight.
    expect(careStage({ weightGrams: 10, hatchDate: '2025-08-16', today: on })).toBe('juvenile');
    // Two months old, any weight: hatchling.
    expect(careStage({ weightGrams: 5, hatchDate: '2026-08-16', today: on })).toBe('hatchling');
    expect(careStage({ today: on })).toBeNull();
    // The reminder stages fold hatchling and juvenile into "growing".
    expect(lifeStage({ weightGrams: 2, today: on })).toBe('growing');
    expect(lifeStage({ today: on })).toBe('growing');
  });

  it('the Keeper\'s Guide weight table is the life-stage pace, not the chart band\'s edges', () => {
    // Until October 2026 the Setup guide showed the weight chart's band
    // under "Healthy weight benchmarks", so 3 g at 6 months, the band's
    // provisional low edge, read as healthy. The table now gives what a
    // typical gecko weighs on the stage pace in husbandry-facts.js.
    const blocks = SETUP_GUIDE.slides.flatMap((slide) => slide.blocks || []);
    const table = blocks.findIndex((block) => block.type === 'kv' && block.rows?.some((r) => r.label === '12 months'));
    expect(blocks[table - 1]).toEqual({ type: 'heading', text: 'Typical weight by age' });
    expect(blocks.some((b) => b.type === 'heading' && /healthy weight/i.test(b.text))).toBe(false);
    const pace = [[0, HATCH_WEIGHT_G.min], ...LIFE_STAGES.filter((s) => s.maxGrams !== null).map((s) => [s.maxMonths, s.maxGrams])];
    const paceAt = (months) => {
      const i = pace.findIndex(([m]) => m >= months);
      const [[m0, g0], [m1, g1]] = [pace[i - 1], pace[i]];
      return g0 + ((g1 - g0) * (months - m0)) / (m1 - m0);
    };
    expect(blocks[table].rows).toEqual([
      { label: 'At hatch', value: `${HATCH_WEIGHT_G.min} to ${HATCH_WEIGHT_G.max} g` },
      ...[3, 6, 12, 18].map((m) => ({ label: `${m} months`, value: `about ${Math.round(paceAt(m))} g` })),
      { label: 'Full adult (2+ yrs)', value: `${ADULT_WEIGHT_G.min} to ${ADULT_WEIGHT_G.max} g` },
    ]);
    expect(blocks[table].rows[2].value).toBe('about 7 g');
    // The pace sentence under it says the facts file's monthly gains.
    expect(blocks[table + 1].text).toContain(`Expect about ${stageGainWords('hatchling')} as a hatchling and ${stageGainWords('juvenile')} as a juvenile`);
  });

  it('every row of the weight-chart blog post sits inside the chart band', () => {
    const post = BLOG_POSTS.find((p) => p.slug === 'crested-gecko-weight-chart-by-age');
    const rows = post.body.find((b) => b.type === 'table').rows;
    for (const [age, range] of rows) {
      const monthsOld = age === 'At hatch' ? 0 : Number(age.match(/\d+/)[0]);
      const [lo, hi] = range.replace('g', '').split('-').map(Number);
      const band = growthBandAt(monthsOld);
      expect(lo, `${age} low`).toBeGreaterThanOrEqual(band.low - 0.5);
      expect(hi, `${age} high`).toBeLessThanOrEqual(band.high + 0.5);
    }
  });

  it('each stage\'s monthly gain contains the pace its boundaries imply', () => {
    let from = { grams: 1.5, months: 0 };
    for (const stage of LIFE_STAGES.filter((s) => s.maxGrams !== null)) {
      const pace = (stage.maxGrams - from.grams) / (stage.maxMonths - from.months);
      expect(pace, stage.id).toBeGreaterThanOrEqual(stage.gainPerMonth[0] - 0.01);
      expect(pace, stage.id).toBeLessThanOrEqual(stage.gainPerMonth[1]);
      from = { grams: stage.maxGrams, months: stage.maxMonths };
    }
  });

  it('llms.txt states the same stages and the one breeding minimum', () => {
    const llms = readFileSync(new URL('../../../public/llms.txt', import.meta.url), 'utf8');
    expect(llms).toContain('hatchling under 3 g and up to 3 months, juvenile 3 to 15 g and 3 to 12 months, sub-adult 15 to 35 g and 12 to 18 months, adult 35 g and up from 18 months');
    expect(llms).toContain(`at least ${BREEDING.femaleMinGrams} g and ${BREEDING.femaleMinMonths} months old`);
    expect(llms).not.toMatch(/35 to 40 g/);
  });
});

describe('one set of incubation windows', () => {
  it('the app\'s hatch estimates and the care guide table are the same numbers', () => {
    expect(INCUBATION_PROFILES).toBe(FACT_PROFILES);
    const rows = section('breeding', 'incubation').body.find((b) => b.type === 'table').rows;
    expect(rows).toEqual(FACT_PROFILES.map((p) => [`${p.fahrenheit} (${p.celsius})`, `${p.minDays} to ${p.maxDays} days`, p.guideNote]));
    const balanced = FACT_PROFILES.find((p) => p.id === 'balanced');
    expect(category('breeding').quickFacts.find((f) => f.label === 'Incubation').value)
      .toBe(`${balanced.minDays} to ${balanced.maxDays} days at ${balanced.fahrenheit}`);
  });

  it('hatch estimates follow the shared windows', () => {
    // Mirrors the growth-band test: the guide's balanced window is what a
    // logged egg gets.
    const dates = getEstimatedHatchDates('2026-09-01', 'balanced');
    expect(format(dates.earliest, 'yyyy-MM-dd')).toBe('2026-11-10'); // +70 days
    expect(format(dates.latest, 'yyyy-MM-dd')).toBe('2026-11-30'); // +90 days
    const cool = getEstimatedHatchDates('2026-09-01', 'cool');
    expect(format(cool.latest, 'yyyy-MM-dd')).toBe('2026-12-30'); // +120 days
  });

  it('no profile goes above the safe incubation temperature', () => {
    for (const p of FACT_PROFILES) {
      const top = Number(p.fahrenheit.match(/(\d+)°F/)[1]);
      expect(top).toBeLessThan(80);
    }
  });
});

describe('one shed rhythm', () => {
  it('the care guide states every stage\'s interval', () => {
    const text = section('health', 'shedding').body[0].text;
    expect(text).toContain(shedRhythmSentence());
    expect(text).not.toMatch(/every 1 to 4 weeks/);
  });

  it('the shed forecast uses the same windows by stage', () => {
    expect(stageShedWindow('hatchling')).toMatchObject({ lo: 7, hi: 14 });
    expect(stageShedWindow('juvenile')).toMatchObject({ lo: 14, hi: 21 });
    expect(stageShedWindow('subadult')).toMatchObject({ lo: 21, hi: 28 });
    expect(stageShedWindow('adult')).toMatchObject({ lo: 28, hi: 42 });
    // Unknown stage: the juvenile rhythm is the middle guess.
    expect(stageShedWindow(null)).toMatchObject({ lo: 14, hi: 21 });
  });

  it('predicts from the gecko\'s stage when it has no shed rhythm of its own', () => {
    const today = new Date(2026, 9, 16);
    const adult = predictNextShed({ hatchDate: '2023-01-01', weights: [], today });
    expect(Math.round((adult.windowStart - today) / 86400000)).toBe(28);
    expect(Math.round((adult.windowEnd - today) / 86400000)).toBe(42);
    expect(adult.basis).toContain('every 4 to 6 weeks');
    const subadult = predictNextShed({
      hatchDate: '2025-08-01',
      weights: [{ record_date: '2026-10-10', weight_grams: 25 }],
      today,
    });
    expect(subadult.basis).toContain('sub-adult');
    expect(subadult.basis).toContain('every 3 to 4 weeks');
    const hatchling = predictNextShed({ hatchDate: '2026-09-01', today });
    expect(hatchling.basis).toContain('every 1 to 2 weeks');
  });

  it('reads the record\'s own weight when no weigh-in is logged', () => {
    // 115 of 368 production geckos had no hatch date in October 2026, some
    // with an adult weight on the record and no weigh-ins. Those adults got
    // the juvenile 2 to 3 week cycle and a shed "due" weeks early.
    const today = new Date(2026, 9, 16);
    const sheds = [{ date: '2026-10-10' }];
    const adult = predictNextShed({ sheds, weights: [], weightGrams: 48, hatchDate: null, today });
    expect(adult.basis).toContain('typical adult cycle (every 4 to 6 weeks)');
    expect(format(adult.windowStart, 'yyyy-MM-dd')).toBe('2026-11-07');
    expect(format(adult.windowEnd, 'yyyy-MM-dd')).toBe('2026-11-21');
    // A logged weigh-in is newer information than the record, so it wins.
    const juvenile = predictNextShed({
      sheds, weights: [{ record_date: '2026-10-12', weight_grams: 9 }], weightGrams: 48, today,
    });
    expect(juvenile.basis).toContain('typical juvenile cycle');
    // No weight anywhere and no hatch date: the juvenile middle guess.
    expect(predictNextShed({ sheds, weightGrams: null, today }).basis).toContain('typical juvenile cycle');
    expect(predictNextShed({ sheds, weightGrams: '', today }).basis).toContain('typical juvenile cycle');
  });
});

describe('one heat danger line', () => {
  // The Feeding guide said "Above 85°F causes heat stress, which can be
  // fatal" while the care guide's "82°F rule", the Handbook and the keeper
  // assistant all said 82°F, so a keeper could read 83 to 84°F as safe.
  const strings = (value) => (typeof value === 'string' ? [value]
    : Array.isArray(value) ? value.flatMap(strings)
      : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : []);
  const HEAT = /heat stress|fatal|dangerous|death/i;

  it('every guide gives the same temperature for heat danger', () => {
    const text = strings([CARE_CATEGORIES, FEEDING_GUIDE, SETUP_GUIDE, HANDBOOK_GUIDE, MORPH_GUIDE, BREEDING_GUIDE]);
    const lines = text.filter((t) => HEAT.test(t) && /(above|past|over) (about )?\d+\s*°F/i.test(t));
    expect(lines.length).toBeGreaterThanOrEqual(3);
    for (const line of lines) {
      for (const [, n] of line.matchAll(/(?:above|past|over) (?:about )?(\d+)\s*°F/gi)) {
        expect(Number(n), line).toBe(HEAT_DANGER_F);
      }
    }
    expect(text).toContain(`Above ${HEAT_DANGER_F}°F (${HEAT_DANGER_C}°C) causes heat stress, which can be fatal.`);
  });

  it('llms.txt says the same', () => {
    const llms = readFileSync(new URL('../../../public/llms.txt', import.meta.url), 'utf8');
    expect(llms).toContain(`above ${HEAT_DANGER_F}°F (${HEAT_DANGER_C}°C) is dangerous`);
  });

  it('so do the Weekly Gecko Notes, which reach members by email', () => {
    // Every number given with "above", "past" or "over" in a note that talks
    // about heat harm is the danger line, and the heat note states it.
    const notes = readWeeklyNotes();
    const text = notes.flatMap((n) => [n.subject, n.cta, n.ctaNoGecko, ...n.paragraphs.map((p) => p.text)]).filter(Boolean);
    const lines = text.filter((t) => HEAT.test(t) && /\d+\s*°F/.test(t));
    expect(lines.length).toBeGreaterThanOrEqual(1);
    for (const line of lines) {
      for (const [, n] of line.matchAll(/(?:above|past|over) (?:about )?(\d+)\s*°F/gi)) {
        expect(Number(n), line).toBe(HEAT_DANGER_F);
      }
    }
    expect(text.join('\n')).toContain(`The number to remember is ${HEAT_DANGER_F}°F.`);
  });
});

describe('weigh-in cadence in the guide matches the reminders', () => {
  it('says the reminder rhythm in words', () => {
    const items = section('health', 'weight-tracking').body.find((b) => b.type === 'ul').items.join(' ');
    expect(items).toContain(`every ${WEIGH_IN_DAYS.growing / 7} weeks while growing`);
    expect(items).toContain(`every ${WEIGH_IN_DAYS.subadult / 7} weeks as a sub-adult`);
    expect(items).toContain(`every ${WEIGH_IN_DAYS.adult} days as an adult`);
  });
});
