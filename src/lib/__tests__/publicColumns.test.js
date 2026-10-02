import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GECKO_PUBLIC_COLUMNS,
  GECKO_IMAGE_PUBLIC_COLUMNS,
  geckoSelect,
} from '../publicColumns';

const getSession = vi.fn();
vi.mock('@/lib/supabaseClient', () => ({
  supabase: { auth: { getSession: (...args) => getSession(...args) } },
}));

const { readColumns } = await import('@/api/supabaseEntities');

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const MIGRATION = resolve(
  __dirname,
  '../../../supabase/migrations/20261002230000_anon_hide_owner_email_columns.sql',
);

/** The column list of the `grant select (...) on public.<table> to anon` in the migration. */
function grantedColumns(sql, table) {
  const match = sql.match(new RegExp(`grant select \\(([^)]*)\\) on public\\.${table} to anon`));
  if (!match) throw new Error(`no anon grant for ${table}`);
  return match[1].split(',').map((c) => c.trim()).filter(Boolean);
}

describe('columns a signed-out visitor may read', () => {
  it('never include an owner email', () => {
    expect(GECKO_PUBLIC_COLUMNS).not.toContain('created_by');
    expect(GECKO_IMAGE_PUBLIC_COLUMNS).not.toContain('created_by');
    expect(GECKO_IMAGE_PUBLIC_COLUMNS).not.toContain('user_id');
    expect(GECKO_IMAGE_PUBLIC_COLUMNS).not.toContain('image_embedding');
  });

  it('carry the owner profile id so pages can show a display name', () => {
    expect(GECKO_PUBLIC_COLUMNS).toContain('owner_profile_id');
    expect(GECKO_IMAGE_PUBLIC_COLUMNS).toContain('owner_profile_id');
  });

  it('match the anon column grants in the database migration exactly', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    expect(grantedColumns(sql, 'geckos')).toEqual(GECKO_PUBLIC_COLUMNS);
    expect(grantedColumns(sql, 'gecko_images')).toEqual(GECKO_IMAGE_PUBLIC_COLUMNS);
  });

  it('geckoSelect reads everything only when signed in', () => {
    expect(geckoSelect(true)).toBe('*');
    expect(geckoSelect(false)).toBe(GECKO_PUBLIC_COLUMNS.join(','));
  });
});

describe('entity reads pick columns by sign-in state', () => {
  beforeEach(() => getSession.mockReset());

  it('uses the public columns for geckos and photos when signed out', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await readColumns('Gecko')).toBe(GECKO_PUBLIC_COLUMNS.join(','));
    expect(await readColumns('GeckoImage')).toBe(GECKO_IMAGE_PUBLIC_COLUMNS.join(','));
  });

  it('reads every column when signed in', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    expect(await readColumns('Gecko')).toBe('*');
    expect(await readColumns('GeckoImage')).toBe('*');
  });

  it('leaves other tables alone without checking the session', async () => {
    expect(await readColumns('WeightRecord')).toBe('*');
    expect(getSession).not.toHaveBeenCalled();
  });
});
