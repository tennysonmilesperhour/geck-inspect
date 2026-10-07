import { act, create } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import GeckoImage from './GeckoImage';
import SmartImage from './SmartImage';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';

describe.each([GeckoImage, SmartImage])('gecko photo fallback', Image => {
  it('shows the bundled silhouette for absent and whitespace-only photos', async () => {
    let view;
    await act(async () => { view = create(<Image src="  " alt="Gecko" />); });
    expect(view.root.findByType('img').props.src).toBe(DEFAULT_GECKO_IMAGE);
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
