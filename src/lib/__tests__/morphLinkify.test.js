import { describe, it, expect } from 'vitest';
import { linkifyMorphText, whereToLook } from '../morphLinkify';
import { MORPHS } from '@/data/morph-guide';

const links = (segs) => segs.filter((s) => s.type === 'morph').map((s) => s.slug);
const joined = (segs) => segs.map((s) => s.text).join('');

describe('linkifyMorphText', () => {
  it('links a morph name inside a sentence', () => {
    const segs = linkifyMorphText('Harlequin sits one step above Flame in pattern coverage.', {
      currentSlug: 'harlequin',
    });
    expect(links(segs)).toEqual(['flame']);
    expect(segs.find((s) => s.type === 'morph').text).toBe('Flame');
  });

  it('never changes the text itself', () => {
    const text = 'A Lilly White with harlequin patterning is sold as a Lilly White.';
    expect(joined(linkifyMorphText(text, { currentSlug: 'cream' }))).toBe(text);
  });

  it('prefers the longest name: "Lilly White" beats "White"', () => {
    const morphs = [
      { slug: 'white', name: 'White', aliases: [] },
      { slug: 'lilly-white', name: 'Lilly White', aliases: ['LW'] },
    ];
    const segs = linkifyMorphText('A Lilly White is not just white.', { morphs });
    expect(segs[1]).toEqual({ type: 'morph', text: 'Lilly White', slug: 'lilly-white' });
    expect(links(segs)).toEqual(['lilly-white', 'white']);
  });

  it('prefers Super Dalmatian over Dalmatian', () => {
    const segs = linkifyMorphText('A Super Dalmatian has more spots.', { currentSlug: 'harlequin' });
    expect(links(segs)).toEqual(['super-dalmatian']);
  });

  it('does not link the current morph', () => {
    const segs = linkifyMorphText('Pair a Harlequin with a Flame.', { currentSlug: 'harlequin' });
    expect(links(segs)).toEqual(['flame']);
  });

  it('does not let the current morph fall back to a shorter name', () => {
    const segs = linkifyMorphText('Never pair two visual Lilly Whites... a Lilly White is fine.', {
      currentSlug: 'lilly-white',
    });
    expect(links(segs)).toEqual([]);
  });

  it('links each morph only once per paragraph', () => {
    const segs = linkifyMorphText('Flame, flame and FLAME.', { currentSlug: 'harlequin' });
    expect(links(segs)).toEqual(['flame']);
  });

  it('is case-insensitive and whole-word only', () => {
    expect(links(linkifyMorphText('a pinstripe pattern', {}))).toEqual(['pinstripe']);
    expect(links(linkifyMorphText('Flamethrower', {}))).toEqual([]);
    expect(links(linkifyMorphText('a near-flame gecko', {}))).toEqual([]);
  });

  it('matches aliases but not generic-word aliases', () => {
    expect(links(linkifyMorphText('My Axie hatched.', {}))).toEqual(['axanthic']);
    expect(links(linkifyMorphText('red tones and solid color', {}))).toEqual([]);
  });

  it('matches short abbreviations only in capitals', () => {
    expect(links(linkifyMorphText('An LW het', {}))).toEqual(['lilly-white']);
    expect(links(linkifyMorphText('an lw het', {}))).toEqual([]);
  });

  it('honors an extra skip list', () => {
    const segs = linkifyMorphText('A Flame keeps its pattern; a Harlequin does not.', {
      currentSlug: 'harlequin',
      skip: ['flame'],
    });
    expect(links(segs)).toEqual([]);
  });

  it('links a plural and keeps the s in the link text', () => {
    const segs = linkifyMorphText('Most tricolors are Harlequins.', { currentSlug: 'tricolor' });
    expect(segs.find((s) => s.type === 'morph')).toEqual({ type: 'morph', text: 'Harlequins', slug: 'harlequin' });
  });

  it('handles empty input', () => {
    expect(linkifyMorphText('', {})).toEqual([]);
    expect(linkifyMorphText(null, {})).toEqual([]);
  });

  it('every linked slug exists in the guide', () => {
    const slugs = new Set(MORPHS.map((m) => m.slug));
    for (const m of MORPHS) {
      for (const s of links(linkifyMorphText(m.description, { currentSlug: m.slug }))) {
        expect(slugs.has(s)).toBe(true);
        expect(s).not.toBe(m.slug);
      }
    }
  });
});

describe('whereToLook', () => {
  it('pulls body parts from the difference sentence first', () => {
    const chips = whereToLook(
      'A Flame keeps its pattern on the back; once the pattern climbs onto the flanks and legs, it is a Harlequin.',
      ['Look at the flanks and legs'],
    );
    expect(chips).toEqual(['Flanks', 'Legs', 'Back']);
  });

  it('finds the eyes for albino lookalikes', () => {
    const chips = whereToLook('Check the eyes: line-bred Moonglows are near-white with dark eyes.', []);
    expect(chips[0]).toBe('Eyes');
  });

  it('returns at most three chips', () => {
    expect(whereToLook('eyes head tail legs flanks back', []).length).toBe(3);
  });
});
