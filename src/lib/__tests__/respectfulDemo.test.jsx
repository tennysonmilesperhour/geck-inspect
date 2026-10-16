import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => vi.stubGlobal('window', { self: null, top: null }));
afterAll(() => vi.unstubAllGlobals());

import ArchiveStatusChip, { archiveStatusFor } from '@/components/my-geckos/ArchiveStatusChip';
import { guestMockFilter } from '@/lib/guestMockData';

const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

describe('a gecko that died is marked with respect', () => {
  it('shows "In memory" in words, not a skull', () => {
    const html = renderToStaticMarkup(<ArchiveStatusChip reason="death" />);
    expect(html).toContain('In memory');
    expect(html).not.toMatch(/💀|☠/);
    // Neutral colours, not alarm red.
    expect(html).not.toMatch(/red-\d/);
  });

  it('spells out every archive reason, with a fallback', () => {
    expect(archiveStatusFor('sold').label).toBe('Sold');
    expect(archiveStatusFor('other').label).toBe('Archived');
    expect(archiveStatusFor(undefined).label).toBe('Archived');
  });

  it('no skull remains on the card, the archive dialog, the list or the edit form', () => {
    for (const file of [
      '../../components/my-geckos/GeckoCard.jsx',
      '../../components/my-geckos/ArchiveReasonDialog.jsx',
      '../../pages/MyGeckos.jsx',
      '../../components/my-geckos/GeckoForm.jsx',
    ]) {
      const text = src(file);
      expect(text, file).not.toMatch(/💀|☠|\bSkull\b/);
    }
  });

  it('the archive dialog and the edit form use the same words for a death', () => {
    for (const file of [
      '../../components/my-geckos/ArchiveReasonDialog.jsx',
      '../../components/my-geckos/GeckoForm.jsx',
    ]) {
      const text = src(file);
      expect(text, file).toContain("value: 'death', label: 'Passed away'");
      expect(text, file).not.toContain('Passed Away');
    }
  });
});

describe('the guest demo forum invents no numbers', () => {
  it('sample posts carry no view counts', async () => {
    const posts = await guestMockFilter('ForumPost', {});
    expect(posts.length).toBeGreaterThan(0);
    for (const post of posts) expect(post.view_count, post.title).toBeUndefined();
  });

  it('a post with no recorded count shows no views line rather than 0', () => {
    expect(src('../../pages/Forum.jsx')).toMatch(/post\.view_count != null && \(/);
    expect(src('../../pages/ForumPost.jsx')).toMatch(/post\.view_count != null && \(/);
  });

  it('labels demo posts as samples', () => {
    expect(src('../../pages/Forum.jsx')).toMatch(/guestDemo && <span[^>]*>Sample<\/span>/);
  });
});
