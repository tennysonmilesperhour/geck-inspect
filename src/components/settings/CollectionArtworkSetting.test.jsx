import { act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GeckoArtworkPicker from '@/components/my-geckos/form/GeckoArtworkPicker';

const mocks = vi.hoisted(() => ({ single: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), merge: vi.fn(), invalidate: vi.fn(), clear: vi.fn(), toast: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: () => ({ update: (...args) => { mocks.update(...args); return { eq: (...filters) => { mocks.eq(...filters); return { select: () => ({ single: mocks.single }) }; } }; } }) } }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ mergeUserExtras: mocks.merge }) }));
vi.mock('@/lib/query-client', () => ({ queryClientInstance: { invalidateQueries: mocks.invalidate } }));
vi.mock('@/lib/layoutCache', () => ({ dataCache: { clearAll: mocks.clear } }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
import CollectionArtworkSetting from './CollectionArtworkSetting';

const user = { email: 'keeper@example.test', auth_user_id: 'owner', gecko_artwork_style: 'nouveau' };
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe('collection artwork setting', () => {
  it('saves only the owner default, refreshes collection data, and persists reset to automatic', async () => {
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
    let tree;
    await act(async () => { tree = create(<CollectionArtworkSetting user={user} />); });
    const picker = () => tree.root.findByType(GeckoArtworkPicker);
    expect(picker().props.gecko.placeholder_style).toBe('nouveau');
    mocks.single.mockResolvedValueOnce({ data: { gecko_artwork_style: 'celestial' }, error: null });
    await act(async () => picker().props.onChange('celestial'));
    expect(mocks.update).toHaveBeenLastCalledWith({ gecko_artwork_style: 'celestial' });
    expect(mocks.eq).toHaveBeenCalledWith('email', user.email);
    expect(mocks.merge).toHaveBeenCalledWith({ gecko_artwork_style: 'celestial' }, 'owner');
    expect(mocks.clear).toHaveBeenCalled();
    expect(mocks.invalidate).toHaveBeenCalled();
    mocks.single.mockResolvedValueOnce({ data: { gecko_artwork_style: null }, error: null });
    await act(async () => picker().props.onChange(null));
    expect(mocks.update).toHaveBeenLastCalledWith({ gecko_artwork_style: null });
    expect(picker().props.gecko.placeholder_style).toBeNull();
    await act(async () => tree.unmount());
  });

  it('restores the saved style and explains a failed save without altering cached data', async () => {
    let tree;
    mocks.single.mockResolvedValue({ data: null, error: new Error('offline') });
    await act(async () => { tree = create(<CollectionArtworkSetting user={user} />); });
    await act(async () => tree.root.findByType(GeckoArtworkPicker).props.onChange('woodcut'));
    expect(tree.root.findByType(GeckoArtworkPicker).props.gecko.placeholder_style).toBe('nouveau');
    expect(tree.root.findByProps({ role: 'alert' }).children.join('')).toContain('previous choice is still active');
    expect(mocks.merge).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
  });
});
