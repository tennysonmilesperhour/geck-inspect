import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GeckoImage from './GeckoImage';
import SmartImage, { smartImageSources } from './SmartImage';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';

const PROJECT = 'https://abcdefghijklmnop.supabase.co';
const MEDIA = `${PROJECT}/storage/v1/object/public/geck-inspect-media`;
const PHOTO = `${MEDIA}/uploads/u1/p1.webp`;
const THUMB = `${MEDIA}/thumbs/uploads/u1/p1.webp`;
const OTHER = `${MEDIA}/uploads/u1/p2.webp`;
const OTHER_THUMB = `${MEDIA}/thumbs/uploads/u1/p2.webp`;

beforeEach(() => vi.stubEnv('VITE_SUPABASE_URL', PROJECT));
afterEach(() => vi.unstubAllEnvs());

const imgSrc = (view) => view.root.findByType('img').props.src;
const fail = (view) => act(async () => view.root.findByType('img').props.onError({}));

describe.each([
  ['SmartImage', SmartImage],
  ['GeckoImage', GeckoImage],
])('%s thumbnails', (_name, Image) => {
  it('tries the thumbnail, then the photo, then the placeholder', async () => {
    const onError = vi.fn();
    let view;
    await act(async () => { view = create(<Image src={PHOTO} width={240} alt="Fern" onError={onError} />); });
    expect(imgSrc(view)).toBe(THUMB);

    await fail(view);
    expect(imgSrc(view)).toBe(PHOTO);
    // A missing thumbnail is not the caller's problem.
    expect(onError).not.toHaveBeenCalled();

    await fail(view);
    expect(imgSrc(view)).toBe(DEFAULT_GECKO_IMAGE);
    expect(onError).toHaveBeenCalledTimes(1);
    await act(async () => view.unmount());
  });

  it('starts a new photo at its own thumbnail', async () => {
    let view;
    await act(async () => { view = create(<Image src={PHOTO} width={96} alt="Fern" />); });
    await fail(view);
    expect(imgSrc(view)).toBe(PHOTO);
    await act(async () => view.update(<Image src={OTHER} width={96} alt="Fern" />));
    expect(imgSrc(view)).toBe(OTHER_THUMB);
    await act(async () => view.unmount());
  });

  it('loads the original for wide slots and when no width is given', async () => {
    let view;
    await act(async () => { view = create(<Image src={PHOTO} width={800} alt="Fern" />); });
    expect(imgSrc(view)).toBe(PHOTO);
    await act(async () => view.update(<Image src={PHOTO} alt="Fern" />));
    expect(imgSrc(view)).toBe(PHOTO);
    await act(async () => view.unmount());
  });

  it('loads photos from anywhere else directly', async () => {
    let view;
    const listing = `${PROJECT}/storage/v1/object/public/listing-images/3833406/1.webp`;
    await act(async () => { view = create(<Image src={listing} width={96} alt="Listing" />); });
    expect(imgSrc(view)).toBe(listing);
    await fail(view);
    expect(imgSrc(view)).toBe(DEFAULT_GECKO_IMAGE);
    await act(async () => view.unmount());
  });

  it('never sets the width hint on the img element', async () => {
    let view;
    await act(async () => { view = create(<Image src={PHOTO} width={96} alt="Fern" />); });
    expect(view.root.findByType('img').props.width).toBeUndefined();
    await act(async () => view.unmount());
  });
});

describe('SmartImage with the gecko artwork fallback', () => {
  it('shows the personalised artwork only after both thumbnail and photo fail', async () => {
    const gecko = { id: 'g1', sex: 'Female', hatch_date: '2020-01-01' };
    let view;
    await act(async () => { view = create(<SmartImage gecko={gecko} src={PHOTO} width={480} alt="Fern" />); });
    expect(imgSrc(view)).toBe(THUMB);
    await fail(view);
    expect(imgSrc(view)).toBe(PHOTO);
    expect(view.root.findAllByProps({ 'data-gecko-placeholder': 'personalized' })).toHaveLength(0);
    await fail(view);
    expect(view.root.findByProps({ 'data-gecko-placeholder': 'personalized' })).toBeTruthy();
    await act(async () => view.unmount());
  });
});

describe('smartImageSources', () => {
  it('uses the paid transform instead of the thumbnail when transforms are switched on', () => {
    const sources = smartImageSources(PHOTO, 240, { transforms: true });
    expect(sources[0]).toContain('/storage/v1/render/image/public/geck-inspect-media/uploads/u1/p1.webp?width=240');
    expect(sources[1]).toBe(PHOTO);
  });

  it('tries the stored thumbnail when transforms are off', () => {
    expect(smartImageSources(PHOTO, 240, { transforms: false })).toEqual([THUMB, PHOTO]);
    expect(smartImageSources(PHOTO, 481, { transforms: false })).toEqual([PHOTO]);
    expect(smartImageSources('', 240, { transforms: false })).toEqual([]);
  });
});
