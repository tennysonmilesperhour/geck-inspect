import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

const fixture = vi.hoisted(() => {
  vi.stubGlobal('window', { self: null, top: null });
  return { builder: null, saved: null, fail: false, toast: vi.fn(), row: null };
});
afterAll(() => vi.unstubAllGlobals());
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: { email: 'fixture@example.com', id: 'legacy-id', auth_user_id: 'auth-uuid', subscription_tier: 'breeder' } }) }));
vi.mock('@/lib/tierLimits', () => ({ tierOf: () => 'breeder' }));
vi.mock('@/entities/all', () => ({ Gecko: { filter: vi.fn() } }));
vi.mock('@/components/bulk/GeckoBulkActions', () => ({ default: () => null }));
vi.mock('@/components/shared/PageHeader', () => ({ default: () => null }));
vi.mock('@/components/storefront/WebsiteBuilder', () => ({ default: props => { fixture.builder = props; return null; } }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: fixture.toast }) }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: table => {
  let payload;
  const result = () => ({ data: table === 'breeder_store_pages' ? fixture.row : table === 'breeder_profiles' ? { id: 'profile-1', display_name: 'Fixture' } : [], error: null });
  const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => result(),
    insert: data => { payload = data; return chain; }, update: data => { payload = data; return chain; },
    single: async () => {
      if (table === 'breeder_store_pages') {
        if (fixture.fail) return { error: { message: 'Save rejected' } };
        fixture.saved = payload; fixture.row = { ...fixture.row, ...payload, id: 'store-1' };
        return { data: fixture.row, error: null };
      }
      return { data: { ...payload, id: 'profile-1' }, error: null };
    }, then: resolve => Promise.resolve(result()).then(resolve),
  }; return chain;
} } }));
import MyStore from '@/pages/MyStore';
import { applyStoreSettings, readStoreSettings } from '@/components/storefront/StorefrontSections';

async function mount() {
  let tree;
  await act(async () => { tree = create(<HelmetProvider><MemoryRouter><MyStore /></MemoryRouter></HelmetProvider>); });
  return tree;
}
async function save(tree) {
  const button = tree.root.findAllByType('button').find(b => b.props.children?.some?.(c => c === 'Save store'));
  expect(button).toBeTruthy();
  await act(async () => { await button.props.onClick(); });
}
beforeEach(() => {
  fixture.toast.mockClear(); fixture.saved = null; fixture.fail = false;
  fixture.row = { id: 'store-1', slug: 'fixture', title: 'Fixture', is_published: true,
    external_links: applyStoreSettings([{ kind: 'instagram', label: 'Instagram', url: 'https://instagram.com/fixture' }], { theme: 'violet', website: { font: 'editorial' } }),
  };
});
describe('MyStore website save flow', () => {
  it('loads the editor, saves website settings, and restores them after remount without exposing reserved link rows', async () => {
    const tree = await mount();
    expect(fixture.builder.settings.website.font).toBe('editorial');
    expect(fixture.builder.form.external_links).toHaveLength(1);
    await act(async () => fixture.builder.onChange({ website: { ...fixture.builder.settings.website, announcement: 'New season', columns: 4 } }));
    await save(tree);
    expect(fixture.saved.owner_email).toBe('fixture@example.com');
    expect(fixture.saved.is_published).toBe(true);
    expect(readStoreSettings(fixture.saved.external_links).website.announcement).toBe('New season');
    expect(fixture.builder.form.external_links).toHaveLength(1);
    await act(async () => tree.unmount());
    const reloaded = await mount();
    expect(fixture.builder.settings.website.columns).toBe(4);
    expect(fixture.builder.settings.website.announcement).toBe('New season');
    await act(async () => reloaded.unmount());
  });
  it('keeps unsaved design edits on a rejected save', async () => {
    const tree = await mount(); fixture.fail = true;
    await act(async () => fixture.builder.onChange({ website: { ...fixture.builder.settings.website, announcement: 'Keep my changes' } }));
    await save(tree);
    expect(fixture.saved).toBeNull();
    expect(fixture.builder.settings.website.announcement).toBe('Keep my changes');
    expect(fixture.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Could not save', variant: 'destructive' }));
    await act(async () => tree.unmount());
  });
});
