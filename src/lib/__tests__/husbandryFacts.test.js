import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { format } from 'date-fns';
import { CARE_CATEGORIES } from '@/data/care-guide';
import {
  BREEDING,
  INCUBATION_PROFILES as FACT_PROFILES,
  LIFE_STAGES,
  WEIGH_IN_DAYS,
  shedRhythmSentence,
  stageGrams,
  stageMonths,
  stageWithGrams,
} from '@/data/husbandry-facts';
import { INCUBATION_PROFILES, getEstimatedHatchDates } from '@/lib/incubationProfiles';
import { careStage, lifeStage } from '@/lib/lifeStage';
import { predictNextShed, stageShedWindow } from '@/lib/shedPrediction';
import { growthBandAt } from '@/lib/growthBand';
import { SETUP_GUIDE } from '@/data/keepers-guides/setup';
import { BLOG_POSTS } from '@/data/blog-posts';

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

  it('the weight chart benchmarks in the Keeper\'s Guide are the chart\'s own band', () => {
    const rows = SETUP_GUIDE.slides
      .flatMap((slide) => slide.blocks || [])
      .find((block) => block.type === 'kv' && block.rows?.some((r) => r.label === '12 months')).rows;
    const months = { '3 months': 3, '6 months': 6, '12 months': 12, '18 months': 18, 'Full adult (2+ yrs)': 24 };
    for (const row of rows) {
      if (!(row.label in months)) continue;
      const [lo, hi] = row.value.replace('g', '').split('-').map(Number);
      const band = growthBandAt(months[row.label]);
      expect([lo, hi], row.label).toEqual([Math.floor(band.low), Math.round(band.high)]);
    }
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
});

describe('weigh-in cadence in the guide matches the reminders', () => {
  it('says the reminder rhythm in words', () => {
    const items = section('health', 'weight-tracking').body.find((b) => b.type === 'ul').items.join(' ');
    expect(items).toContain(`every ${WEIGH_IN_DAYS.growing / 7} weeks while growing`);
    expect(items).toContain(`every ${WEIGH_IN_DAYS.subadult / 7} weeks as a sub-adult`);
    expect(items).toContain(`every ${WEIGH_IN_DAYS.adult} days as an adult`);
  });
});
