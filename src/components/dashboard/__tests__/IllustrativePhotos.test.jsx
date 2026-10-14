import { create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/shared/GeckoImage', () => ({
  default: ({ src, alt, ...props }) => <img src={src} alt={alt} {...props} />,
}));
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }) => <section>{children}</section>,
  CardContent: ({ children }) => <div>{children}</div>,
  CardHeader: ({ children }) => <header>{children}</header>,
  CardTitle: ({ children }) => <h2>{children}</h2>,
}));
vi.mock('@/components/ui/skeleton', () => ({ Skeleton: () => null }));
vi.mock('lucide-react', () => ({
  Calendar: () => null,
  Image: () => null,
  Star: () => null,
}));
vi.mock('react-router-dom', () => ({ Link: ({ children, to }) => <a href={to}>{children}</a> }));
vi.mock('@/utils', () => ({ createPageUrl: (path) => `/${path}` }));
vi.mock('@/lib/publicColumns', () => ({ publicDisplayName: (user) => user?.full_name || 'Keeper' }));

import GeckoOfTheDay from '../GeckoOfTheDay';
import RecentActivity from '../RecentActivity';

const textOf = (tree) => {
  const visit = (node) => {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(visit).join('');
    return (node.children || []).map(visit).join('');
  };
  return visit(tree.toJSON());
};

describe('dashboard illustrative photo labels', () => {
  it('labels an illustrative Gecko of the Day photo and describes it safely', () => {
    const tree = create(
      <GeckoOfTheDay fallbackGecko={{ image: {
        image_url: '/demo/geckos/macro-portrait.jpg',
        photo_is_illustrative: true,
        primary_morph: 'Lilly White',
      } }} />,
    );
    expect(textOf(tree)).toContain('Illustrative photo');
    expect(tree.root.findByType('img').props.alt).toBe('Illustrative gecko photo, not the demo animal');
    tree.unmount();
  });

  it('keeps ordinary Gecko of the Day photos unbadged', () => {
    const tree = create(
      <GeckoOfTheDay geckoOfTheDay={{ image: {
        image_url: '/member/gecko.jpg',
        photo_is_illustrative: false,
        primary_morph: 'Harlequin',
      } }} />,
    );
    expect(textOf(tree)).not.toContain('Illustrative photo');
    expect(tree.root.findByType('img').props.alt).toBe('Gecko of the day');
    tree.unmount();
  });

  it('keeps the illustrative label visible on Latest Community Upload tiles', () => {
    const tree = create(
      <RecentActivity isLoading={false} geckoImages={[{
        id: 'demo-image',
        image_url: '/demo/geckos/licking-lips.jpg',
        primary_morph: null,
        created_date: '2026-10-01T12:00:00.000Z',
        photo_is_illustrative: true,
      }]} />,
    );
    expect(textOf(tree)).toContain('Illustrative photo');
    expect(tree.root.findByType('img').props.alt).toBe('Illustrative gecko photo, not the demo animal');
    tree.unmount();
  });

  it('keeps ordinary Latest Community Upload tiles unbadged', () => {
    const tree = create(
      <RecentActivity isLoading={false} geckoImages={[{
        id: 'member-image',
        image_url: '/member/gecko.jpg',
        primary_morph: 'Harlequin',
        created_date: '2026-10-01T12:00:00.000Z',
        photo_is_illustrative: false,
      }]} />,
    );
    expect(textOf(tree)).not.toContain('Illustrative photo');
    expect(tree.root.findByType('img').props.alt).toBe('Harlequin');
    tree.unmount();
  });
});
