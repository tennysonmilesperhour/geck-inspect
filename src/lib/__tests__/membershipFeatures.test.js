import { describe, expect, it } from 'vitest';
import { consultantAllowanceLine, featuresWithConsultant, pageIsLive } from '../membershipFeatures';

describe('AI Consultant allowance lines', () => {
  it('match the server allotments (feature_credit_allotments, Oct 2026)', () => {
    expect(consultantAllowanceLine('free')).toBe('10 AI Consultant messages per month');
    expect(consultantAllowanceLine('keeper')).toBe('100 AI Consultant messages per month');
    expect(consultantAllowanceLine('breeder')).toBe('400 AI Consultant messages per month');
    expect(consultantAllowanceLine('enterprise')).toBe('1,000 AI Consultant messages per month');
  });

  it('sits after the Morph ID line, and only while the page is live', () => {
    const features = ['Everything in Free', '3 AI Morph IDs per month', '10 GB of photo storage'];
    expect(featuresWithConsultant('keeper', features, false)).toBe(features);
    expect(featuresWithConsultant('keeper', features, true)).toEqual([
      'Everything in Free', '3 AI Morph IDs per month', '100 AI Consultant messages per month', '10 GB of photo storage',
    ]);
  });

  it('treats a page as live unless every config row is off', () => {
    expect(pageIsLive([{ is_enabled: false }])).toBe(false);
    expect(pageIsLive([{ is_enabled: false }, { is_enabled: true }])).toBe(true);
    expect(pageIsLive([])).toBe(false);
    expect(pageIsLive(null)).toBe(false);
  });
});
