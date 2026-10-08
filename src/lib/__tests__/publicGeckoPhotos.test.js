import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PUBLIC_GECKO_PHOTO_COLUMNS,
  fetchHeroAnchorPhotos,
  fetchProjectLinePhotos,
  publicPhotoColumnsAreGranted,
} from '../publicGeckoPhotos';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');

function read(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

describe('public gecko photo columns', () => {
  it('uses only columns the anon grant keeps', () => {
    expect(publicPhotoColumnsAreGranted()).toBe(true);
    expect(PUBLIC_GECKO_PHOTO_COLUMNS).not.toMatch(/training_meta|created_by|user_id|image_embedding/);
  });

  it('the public pages do not select training_meta or an owner email', () => {
    for (const file of [
      'src/components/morphguide/MorphIndexData.js',
      'src/pages/ProjectLineDetail.jsx',
      'src/lib/publicGeckoPhotos.js',
    ]) {
      const src = read(file);
      expect(src, file).not.toMatch(/select\([^)]*training_meta/);
      expect(src, file).not.toMatch(/training_meta->>/);
      expect(src, file).not.toMatch(/\.select\([^)]*created_by/);
    }
  });

  it('the follow-up function returns captions and not the JSON column', () => {
    const sql = read('supabase/migrations/20261008080000_public_gecko_photos.sql');
    expect(sql).toContain('security definer');
    expect(sql).toContain('grant execute on function public.public_gecko_photos(text, text, integer) to anon, authenticated, service_role');
    expect(sql).toContain('revoke all on function public.public_gecko_photos(text, text, integer) from public');
    expect(sql).toContain("p_kind = 'hero'");
    expect(sql).toContain("verification_tier' = 'hero_anchor'");
    expect(sql).toContain("position('@'");
    const returns = sql.slice(sql.indexOf('returns table'), sql.indexOf('language sql'));
    expect(returns).not.toContain('training_meta');
    expect(returns).not.toContain('created_by');
  });
});

describe('public gecko photo fetches', () => {
  it('uses the public function for show-winner photos', async () => {
    const calls = [];
    const client = {
      rpc(name, args) {
        calls.push([name, args]);
        return Promise.resolve({
          data: [{ image_url: 'https://cdn.example/lilly.jpg', primary_morph: 'lilly white', photo_credit: 'Alex', gecko_name: 'Pearl', award: 'Show' }],
          error: null,
        });
      },
    };
    const rows = await fetchHeroAnchorPhotos(client, 200);
    expect(calls).toEqual([['public_gecko_photos', { p_kind: 'hero', p_query: null, p_limit: 200 }]]);
    expect(rows[0].image_url).toBe('https://cdn.example/lilly.jpg');
    expect(rows[0].photo_credit).toBe('Alex');
  });

  it('returns no show-winner rows when the function is not installed yet', async () => {
    const client = {
      rpc() {
        return Promise.resolve({ data: null, error: { code: 'PGRST202' } });
      },
    };
    expect(await fetchHeroAnchorPhotos(client)).toEqual([]);
  });

  it('falls back to granted columns for a project line when the function is missing', async () => {
    const calls = [];
    const builder = {
      select(cols) { calls.push(['select', cols]); return builder; },
      not(...args) { calls.push(['not', ...args]); return builder; },
      ilike(...args) { calls.push(['ilike', ...args]); return builder; },
      limit(n) {
        calls.push(['limit', n]);
        return Promise.resolve({
          data: [{ image_url: 'https://cdn.example/line.jpg', primary_morph: 'lilly white' }],
          error: null,
        });
      },
    };
    const client = {
      rpc() {
        return Promise.resolve({ data: null, error: { code: 'PGRST202' } });
      },
      from(table) {
        calls.push(['from', table]);
        return builder;
      },
    };
    const rows = await fetchProjectLinePhotos(client, 'lilly white', 8);
    expect(calls).toContainEqual(['from', 'gecko_images']);
    expect(calls).toContainEqual(['select', PUBLIC_GECKO_PHOTO_COLUMNS]);
    expect(calls).toContainEqual(['ilike', 'primary_morph', '%lilly white%']);
    expect(rows).toEqual([{
      url: 'https://cdn.example/line.jpg',
      primaryMorph: 'lilly white',
      credit: null,
      geckoName: null,
    }]);
  });

  it('keeps captions from the public function and strips wildcard characters from the search', async () => {
    const client = {
      rpc(_name, args) {
        expect(args.p_query).toBe('lilly white');
        return Promise.resolve({
          data: [{ image_url: 'https://cdn.example/line.jpg', primary_morph: 'lilly white', photo_credit: 'Sam', gecko_name: 'Nova' }],
          error: null,
        });
      },
      from() {
        throw new Error('fallback should not run');
      },
    };
    const rows = await fetchProjectLinePhotos(client, 'lilly% white_', 8);
    expect(rows[0]).toMatchObject({ credit: 'Sam', geckoName: 'Nova' });
  });
});
