import { useState } from 'react';
import { act, create } from 'react-test-renderer';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
const state = vi.hoisted(() => {
  vi.stubGlobal('window', { self: null, top: null });
  return { upload: vi.fn(), settings: null };
});
afterAll(() => vi.unstubAllGlobals());
vi.mock('@/lib/uploadFile', () => ({ uploadFile: state.upload }));
import WebsiteBuilder from '@/components/storefront/WebsiteBuilder';
function Harness() {
  const [settings, setSettings] = useState({}); state.settings = settings;
  return <MemoryRouter><WebsiteBuilder settings={settings} onChange={p => setSettings(s => ({ ...s, ...p }))}
    form={{ title: 'Fixture', tagline: '', header_image_url: '', contact_link: '', description: '', policies: '', featured_gecko_ids: [], featured_breeding_plan_ids: [] }}
    onFormChange={() => {}} profile={{}} geckos={[]} plans={[]} /></MemoryRouter>;
}
describe('builder image upload', () => {
  it('uses the shared upload helper and keeps other design edits made during the upload', async () => {
    let resolve;
    state.upload.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    let tree;
    await act(async () => { tree = create(<Harness />); });
    act(() => tree.root.findAllByType('button').find(b => b.props.children?.[1] === 'Brand').props.onClick());
    const input = tree.root.findByProps({ 'aria-label': 'Upload logo' });
    let pending;
    await act(async () => { pending = input.props.onChange({ target: { files: [{ type: 'image/png', name: 'logo.png' }], value: '' } }); });
    act(() => tree.root.findAllByType('input').find(i => i.props.id === 'website-announcement').props.onChange({ target: { value: 'Do not overwrite' } }));
    await act(async () => { resolve({ file_url: 'https://example.com/logo.png' }); await pending; });
    expect(state.upload).toHaveBeenCalledWith({ file: expect.objectContaining({ name: 'logo.png' }), folder: 'storefront' });
    expect(state.settings.website.logoUrl).toBe('https://example.com/logo.png');
    expect(state.settings.website.announcement).toBe('Do not overwrite');
    act(() => tree.unmount());
  });
  it('shows an upload error without changing the existing logo', async () => {
    state.upload.mockRejectedValueOnce(new Error('Storage quota reached'));
    let tree;
    await act(async () => { tree = create(<Harness />); });
    act(() => tree.root.findAllByType('button').find(b => b.props.children?.[1] === 'Brand').props.onClick());
    await act(async () => { await tree.root.findByProps({ 'aria-label': 'Upload logo' }).props.onChange({ target: { files: [{}], value: '' } }); });
    expect(tree.root.findByProps({ role: 'alert' }).children).toContain('Storage quota reached');
    expect(state.settings.website).toBeUndefined();
    act(() => tree.unmount());
  });
});
