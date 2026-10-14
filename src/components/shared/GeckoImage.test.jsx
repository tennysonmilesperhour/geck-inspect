import { act, create } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import GeckoImage from './GeckoImage';
import SmartImage from './SmartImage';
import GeckoPlaceholder from './GeckoPlaceholder';
import { DEFAULT_GECKO_CARD, DEFAULT_GECKO_IMAGE } from '@/lib/constants';

describe.each([GeckoImage, SmartImage])('gecko photo fallback', Image => {
  it('shows the square placeholder for absent and whitespace-only photos', async () => {
    let view;
    await act(async () => { view = create(<Image src="  " alt="Gecko" />); });
    expect(view.root.findByType('img').props.src).toBe(DEFAULT_GECKO_IMAGE);
    expect(view.root.findByType('img').props.style.objectFit).toBe('contain');
    await act(async () => view.unmount());
  });

  it('letterboxes the full card when a large view asks for it', async () => {
    let view;
    await act(async () => { view = create(<Image src={undefined} fallback={DEFAULT_GECKO_CARD} alt="Gecko" />); });
    expect(view.root.findByType('img').props.src).toBe(DEFAULT_GECKO_CARD);
    expect(view.root.findByType('img').props.style.objectFit).toBe('contain');
    await act(async () => view.unmount());
  });

  it('recovers from a broken photo and shows a new photo when the source changes', async () => {
    let view;
    await act(async () => { view = create(<Image src="/broken.jpg" alt="Gecko" style={{ transform: 'rotate(90deg)' }} />); });
    await act(async () => view.root.findByType('img').props.onError({}));
    expect(view.root.findByType('img').props.src).toBe(DEFAULT_GECKO_IMAGE);
    expect(view.root.findByType('img').props.style.transform).toBe('none');
    await act(async () => view.update(<Image src="/new.jpg" alt="Gecko" />));
    expect(view.root.findByType('img').props.src).toBe('/new.jpg');
    await act(async () => view.unmount());
  });
});

describe.each([GeckoImage, SmartImage])('personalized gecko artwork', Image => {
  it('updates recorded sex and age without shuffling style, then yields to a real photo', async () => {
    const gecko = { id: 'stable-gecko', name: 'Fern', sex: 'Unsexed' };
    let view;
    await act(async () => { view = create(<Image gecko={gecko} alt="Fern" style={{ transform: 'rotate(90deg)' }} />); });
    let art = view.root.findByProps({ 'data-gecko-placeholder': 'personalized' });
    const family = art.props['data-art-style'];
    expect(art.props['data-sex']).toBe('unsexed');
    expect(art.props['data-age-group']).toBe('unknown');
    expect(art.props['aria-label']).toContain('age not set');
    expect(art.props.style).toMatchObject({ objectFit: 'contain', transform: 'none' });

    await act(async () => view.update(<Image gecko={{ ...gecko, name: 'Renamed', sex: 'Female', hatch_date: '2020-01-01' }} />));
    art = view.root.findByProps({ 'data-gecko-placeholder': 'personalized' });
    expect(art.props['data-art-style']).toBe(family);
    expect(art.props['data-sex']).toBe('female');
    expect(art.props['data-age-group']).toBe('adult');
    expect(art.props['aria-label']).toContain('Renamed');

    await act(async () => view.update(<Image gecko={gecko} src="/my-gecko.jpg" alt="Fern" />));
    expect(view.root.findAllByType('svg')).toHaveLength(0);
    expect(view.root.findByType('img').props.src).toBe('/my-gecko.jpg');
    await act(async () => view.update(<Image gecko={gecko} src="" alt="Fern" />));
    expect(view.root.findByProps({ 'data-gecko-placeholder': 'personalized' }).props['data-art-style']).toBe(family);
    await act(async () => view.unmount());
  });

  it('uses personalized artwork after a broken real photo and recovers when replaced', async () => {
    const gecko = { id: 'photo-fallback', sex: 'Male', hatch_date: '2020-01-01', placeholder_style: 'celestial' };
    let view;
    await act(async () => { view = create(<Image gecko={gecko} src="/missing-photo.jpg" />); });
    await act(async () => view.root.findByType('img').props.onError({}));
    expect(view.root.findByProps({ 'data-gecko-placeholder': 'personalized' }).props['data-sex']).toBe('male');
    expect(view.root.findByProps({ 'data-gecko-placeholder': 'personalized' }).props['data-art-style']).toBe('celestial');
    await act(async () => view.update(<Image gecko={gecko} src="/replacement.jpg" />));
    expect(view.root.findByType('img').props.src).toBe('/replacement.jpg');
    expect(view.root.findAllByType('svg')).toHaveLength(0);
    await act(async () => view.unmount());
  });
});

it('falls back safely if an illustration file fails and retries when its age artwork changes', async () => {
  const now = new Date(2026, 9, 14);
  const gecko = { id: 'asset-fallback', sex: 'Female', hatch_date: '2026-09-01' };
  let view;
  await act(async () => { view = create(<GeckoPlaceholder gecko={gecko} now={now} />); });
  expect(view.root.findByType('img').props.src).toContain('-hatchling-512.webp');
  await act(async () => view.root.findByType('img').props.onError({}));
  expect(view.root.findByType('img').props.src).toBe(DEFAULT_GECKO_IMAGE);
  expect(view.root.findAllByType('text')).toHaveLength(0);
  await act(async () => view.root.findByType('img').props.onError({}));
  expect(view.root.findByType('img').props.src).toBe(DEFAULT_GECKO_IMAGE);
  await act(async () => view.update(<GeckoPlaceholder gecko={{ ...gecko, hatch_date: '2025-12-01' }} now={now} />));
  expect(view.root.findByType('img').props.src).toContain('-juvenile-512.webp');
  await act(async () => view.unmount());
});
