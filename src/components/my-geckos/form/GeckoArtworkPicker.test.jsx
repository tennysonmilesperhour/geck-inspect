import { useState } from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import GeckoArtworkPicker from './GeckoArtworkPicker';
import { geckoArtStyle } from '@/lib/geckoPlaceholderProfiles';

const gecko = { id: 'artwork-choice', name: 'Fern', sex: 'Female', hatch_date: '2020-01-01' };
const preview = tree => tree.root.findAllByProps({ 'data-gecko-placeholder': 'personalized' })[0];
const radio = (tree, value) => tree.root.findByProps({ type: 'radio', value });

function Editor({ onChange }) {
  const [style, setStyle] = useState(null);
  return <GeckoArtworkPicker gecko={{ ...gecko, placeholder_style: style }} onChange={value => { setStyle(value); onChange(value); }} />;
}

describe('artwork style picker', () => {
  it('previews each choice immediately and sends null when the collection default is restored', async () => {
    const onChange = vi.fn();
    let tree;
    await act(async () => { tree = create(<Editor onChange={onChange} />); });
    expect(tree.root.findAllByProps({ type: 'radio' })).toHaveLength(6);
    expect(radio(tree, 'automatic').props.checked).toBe(true);
    const original = geckoArtStyle(gecko).id;
    expect(preview(tree).props['data-art-style']).toBe(original);
    await act(async () => radio(tree, 'celestial').props.onChange());
    expect(onChange).toHaveBeenLastCalledWith('celestial');
    expect(radio(tree, 'celestial').props.checked).toBe(true);
    expect(preview(tree).props['data-art-style']).toBe('celestial');
    expect(preview(tree).props['data-sex']).toBe('female');
    await act(async () => radio(tree, 'automatic').props.onChange());
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(preview(tree).props['data-art-style']).toBe(original);
    await act(async () => tree.unmount());
  });

  it('shows the inherited style without selecting it as an individual override', async () => {
    let tree;
    await act(async () => { tree = create(<GeckoArtworkPicker gecko={{ ...gecko, inherited_placeholder_style: 'terracotta' }} onChange={vi.fn()} />); });
    expect(radio(tree, 'automatic').props['aria-label']).toBe('Collection default');
    expect(radio(tree, 'automatic').props.checked).toBe(true);
    expect(radio(tree, 'terracotta').props.checked).toBe(false);
    expect(preview(tree).props['data-art-style']).toBe('terracotta');
    await act(async () => tree.unmount());
  });

  it('offers the stable automatic mix in the collection settings', async () => {
    let tree;
    await act(async () => { tree = create(<GeckoArtworkPicker gecko={gecko} collectionDefault onChange={vi.fn()} />); });
    expect(radio(tree, 'automatic').props['aria-label']).toBe('Automatic mix');
    expect(preview(tree).props['data-art-style']).toBe(geckoArtStyle(gecko).id);
    await act(async () => tree.unmount());
  });

  it('opens on the stored choice and disables choices on archived animals', async () => {
    let tree;
    await act(async () => { tree = create(<GeckoArtworkPicker gecko={{ ...gecko, placeholder_style: 'nouveau' }} onChange={vi.fn()} disabled />); });
    expect(radio(tree, 'nouveau').props.checked).toBe(true);
    expect(preview(tree).props['data-art-style']).toBe('nouveau');
    for (const input of tree.root.findAllByProps({ type: 'radio' })) expect(input.props.disabled).toBe(true);
    await act(async () => tree.unmount());
  });
});
