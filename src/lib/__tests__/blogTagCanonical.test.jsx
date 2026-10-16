import { afterAll, describe, expect, it, vi } from 'vitest';
import { act, create } from 'react-test-renderer';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const fixture = vi.hoisted(() => {
  vi.stubGlobal('window', { self: null, top: null });
  return { seo: null };
});
afterAll(() => vi.unstubAllGlobals());

vi.mock('@/components/seo/Seo', () => ({ default: (props) => { fixture.seo = props; return null; } }));
vi.mock('@/components/public/PublicPageShell', () => ({ default: ({ children }) => children }));
vi.mock('@/lib/blog-data-source', () => {
  const tag = (slug) => ({ slug, name: slug });
  const posts = [
    { slug: 'crested-gecko-breeding-records', title: 'Breeding records', description: 'd', tags: [tag('records')] },
    { slug: 'crested-gecko-diet-guide', title: 'Diet', description: 'd', tags: [tag('care')] },
  ];
  return {
    useBlogContent: () => ({ posts, tags: [tag('records'), tag('care')], settings: { blog_enabled: true }, loading: false }),
    postsForTagSlug: (all, slug) => all.filter((p) => p.tags.some((t) => t.slug === slug)),
  };
});

import BlogTagPage from '@/pages/BlogTagPage';
import { TAG_CANONICAL, tagCanonicalTarget } from '@/lib/blogTagCanonical';

async function render(path) {
  let tree;
  await act(async () => {
    tree = create(
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/blog/tag/:slug" element={<BlogTagPage />} /></Routes>
      </MemoryRouter>,
    );
  });
  return tree;
}

describe('blog tag canonical hint', () => {
  it('points the records tag at /breeding-records and links there', async () => {
    const tree = await render('/blog/tag/records');
    expect(fixture.seo.path).toBe('/breeding-records');
    const hrefs = tree.root.findAll((n) => n.type === 'a').map((a) => a.props.href);
    expect(hrefs).toContain('/breeding-records');
  });

  it('leaves every other tag page canonical to itself', async () => {
    const tree = await render('/blog/tag/care');
    expect(fixture.seo.path).toBe('/blog/tag/care');
    const hrefs = tree.root.findAll((n) => n.type === 'a').map((a) => a.props.href);
    expect(hrefs).not.toContain('/breeding-records');
  });

  it('only names pages that exist and ignores inherited keys', () => {
    for (const target of Object.values(TAG_CANONICAL)) expect(target.path).toMatch(/^\/[a-z-]+$/);
    expect(tagCanonicalTarget('constructor')).toBeNull();
    expect(tagCanonicalTarget(undefined)).toBeNull();
  });
});
