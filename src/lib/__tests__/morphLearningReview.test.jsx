import React from 'react';
import { existsSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RecognitionCheck from '@/components/preview/morph-study/RecognitionCheck';
import SpecimenFigure from '@/components/preview/morph-study/SpecimenFigure';
import { pigmentIslands, isolatePigment, orderedIslands, selectedIslands, studyPinSegments, normalizeStages } from '@/components/preview/morph-study/patternIslands';
import { RAINDROP_RIGHT, REVIEW_LESSONS, REVIEW_QUESTIONS, REVIEW_SPECIMENS, recognitionSummary } from '@/components/preview/morph-study/reviewStudyData';

afterEach(() => vi.unstubAllGlobals());
const nodeText = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(nodeText).join('') : node?.children?.map(nodeText).join('') || '';

describe('specimen evidence and independent recognition', () => {
  it('holds out whole animals, including alternate views, from the lessons', () => {
    const lessonAnimals = new Set(REVIEW_LESSONS.flatMap(l => l.examples.map(id => REVIEW_SPECIMENS[id].animalId)));
    lessonAnimals.add(RAINDROP_RIGHT.animalId);
    const testAnimals = REVIEW_QUESTIONS.map(q => REVIEW_SPECIMENS[q.specimen].animalId);
    expect(new Set(testAnimals).size).toBe(testAnimals.length);
    testAnimals.forEach(id => expect(lessonAnimals.has(id)).toBe(false));
    expect(RAINDROP_RIGHT.animalId).toBe(REVIEW_SPECIMENS.raindrop.animalId);
    expect(RAINDROP_RIGHT.src).not.toBe(REVIEW_SPECIMENS.raindrop.src);
  });
  it('uses credited local photographs with bounded annotations and multiple specimens per lesson', () => {
    for (const photo of Object.values(REVIEW_SPECIMENS)) {
      expect(photo.reuseApproved).toBe(true);
      expect(existsSync(`public${photo.src}`)).toBe(true);
      expect(photo.source).toContain(photo.animalId);
      expect(photo.credit).toBeTruthy();
      for (const point of Object.values(photo.features).flat()) {
        expect(point.x).toBeGreaterThanOrEqual(0); expect(point.x).toBeLessThanOrEqual(100);
        expect(point.y).toBeGreaterThanOrEqual(0); expect(point.y).toBeLessThanOrEqual(100);
      }
    }
    for (const lesson of REVIEW_LESSONS) expect(new Set(lesson.examples.map(id => REVIEW_SPECIMENS[id].animalId)).size).toBeGreaterThan(1);
  });
  it('does not reveal names, observation annotations or keeper records before an answer', () => {
    const photo = REVIEW_SPECIMENS.odin;
    const blind = renderToStaticMarkup(<SpecimenFigure specimen={photo} blind annotated={false} label="Specimen 1" />);
    expect(blind).not.toContain(photo.name);
    expect(blind).not.toContain(photo.description);
    expect(blind).not.toContain(photo.source);
    expect(blind).not.toContain(photo.features.lateral[0].label);
    const answered = renderToStaticMarkup(<SpecimenFigure specimen={photo} />);
    expect(answered).toContain(photo.source);
    expect(answered).toContain(photo.features.lateral[0].label);
  });
  it('locks the first answer, distinguishes a description hint and reports the actual result', () => {
    vi.stubGlobal('requestAnimationFrame', cb => cb());
    let tree;
    act(() => { tree = create(<RecognitionCheck onReviewLesson={() => {}} />); });
    const click = text => act(() => tree.root.findAllByType('button').find(b => nodeText(b) === text).props.onClick());
    for (let index = 0; index < REVIEW_QUESTIONS.length; index++) {
      const q = REVIEW_QUESTIONS[index];
      const findAnswer = i => tree.root.findAllByType('button').find(b => nodeText(b) === q.answers[i]);
      expect(findAnswer(0).props.disabled).toBe(true);
      act(() => tree.root.findByType('img').props.onLoad());
      if (index === 1) click('Describe the photograph (counts as a hint)');
      const choice = index === 0 ? 0 : q.correct;
      click(q.answers[choice]);
      expect(findAnswer(choice).props['aria-pressed']).toBe(true);
      expect(findAnswer(q.correct).props.disabled).toBe(true);
      // A stale/double click cannot rewrite an earlier wrong answer.
      act(() => findAnswer(q.correct).props.onClick());
      expect(findAnswer(choice).props['aria-pressed']).toBe(true);
      click(index === REVIEW_QUESTIONS.length - 1 ? 'See my observations' : 'Next specimen');
    }
    const result = nodeText(tree.toJSON());
    expect(result).toContain('2 of 4 independently observed');
    expect(result).toContain('1 used the description hint');
    expect(result).toContain('Worth another look');
    click('Practice these photographs again');
    expect(nodeText(tree.toJSON())).toContain('Repeat practice');
    act(() => tree.unmount());
  });
  it('does not score a missing photograph and offers a skip', () => {
    vi.stubGlobal('requestAnimationFrame', cb => cb());
    let tree;
    act(() => { tree = create(<RecognitionCheck onReviewLesson={() => {}} />); });
    act(() => tree.root.findByType('img').props.onError());
    const buttons = tree.root.findAllByType('button');
    const answer = buttons.find(b => nodeText(b) === REVIEW_QUESTIONS[0].answers[0]);
    expect(answer.props.disabled).toBe(true);
    act(() => buttons.find(b => nodeText(b) === 'Skip unavailable photograph').props.onClick());
    expect(nodeText(tree.toJSON())).toContain('Specimen 2');
    expect(recognitionSummary({ lateral: { choice: null, skipped: true } })).toMatchObject({ independentCorrect: 0, revisit: ['harlequin'] });
    act(() => tree.unmount());
  });
});

describe('whole pigment islands', () => {
  const width = 24, height = 12;
  function paintedPixels() {
    const pixels = new Uint8ClampedArray(width * height * 4);
    // Two irregular, separated shapes. Colored transparent background checks
    // that grouping bridges cannot accidentally become visible pigment.
    for (let at = 0; at < width * height; at++) { pixels[at * 4] = 211; pixels[at * 4 + 1] = 191; pixels[at * 4 + 2] = 140; }
    for (const [x, y] of [[1, 2], [2, 2], [2, 3], [3, 4], [17, 6], [18, 6], [19, 7], [18, 8], [17, 9]]) pixels[(y * width + x) * 4 + 3] = x === 1 ? 170 : 255;
    return pixels;
  }
  it('reveals complete original patches without drawing new pixels, recoloring or fading', () => {
    const original = paintedPixels();
    const { groups, labels } = pigmentIslands(original, width, height);
    expect(groups).toHaveLength(2);
    const selected = new Set([groups[0].id]);
    const result = isolatePigment(original, labels, selected);
    for (let at = 0; at < width * height; at++) {
      const offset = at * 4;
      expect([...result.slice(offset, offset + 3)]).toEqual([...original.slice(offset, offset + 3)]);
      expect(result[offset + 3]).toBe(selected.has(labels[at]) ? original[offset + 3] : 0);
      if (!original[offset + 3]) expect(result[offset + 3]).toBe(0);
    }
    expect([...original]).toEqual([...paintedPixels()]);
  });
  it('does not connect the right edge of one scanline to the left of the next', () => {
    const pixels = new Uint8ClampedArray(width * height * 4);
    pixels[(width - 1) * 4 + 3] = 255;
    pixels[width * 4 + 3] = 255;
    expect(pigmentIslands(pixels, width, height).groups).toHaveLength(2);
  });
  it('adds whole islands monotonically across named settings', () => {
    const { groups } = pigmentIslands(paintedPixels(), width, height);
    const ordered = orderedIslands(groups, 'lateral', 'side');
    expect(ordered[0].y).toBeGreaterThan(ordered[1].y);
    let previous = new Set();
    for (let stage = 0; stage <= 4; stage++) {
      const next = selectedIslands(ordered, stage);
      for (const id of previous) expect(next.has(id)).toBe(true);
      previous = next;
    }
    expect(selectedIslands(ordered, 0).size).toBe(0);
    expect(selectedIslands(ordered, 4).size).toBe(groups.length);
    expect(normalizeStages({ lateral: 999, pinstripe: -1, tiger: 7, spots: NaN })).toEqual({ dorsal: 0, lateral: 4, pinstripe: 0, spots: 0, tiger: 1 });
  });
  it('keeps pin clusters bounded, asymmetric and nested, with a shared near-side row', () => {
    expect(studyPinSegments(0)).toEqual([]);
    expect(studyPinSegments(5)).toEqual([{ start: 0, length: 100 }]);
    expect(studyPinSegments(2, 0)).not.toEqual(studyPinSegments(2, 1));
    for (const row of [0, 1]) {
      let previous = [];
      for (let stage = 0; stage <= 5; stage++) {
        const segments = studyPinSegments(stage, row);
        for (const s of segments) { expect(s.start).toBeGreaterThanOrEqual(0); expect(s.start + s.length).toBeLessThanOrEqual(100.000001); }
        for (const old of previous) expect(segments.some(s => s.start <= old.start + .000001 && s.start + s.length >= old.start + old.length - .000001)).toBe(true);
        previous = segments;
      }
    }
  });
});
