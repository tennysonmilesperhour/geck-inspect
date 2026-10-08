import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const invoke = vi.fn();
vi.mock('@/lib/supabaseClient', () => ({
  supabase: { functions: { invoke: (...args) => invoke(...args) } },
}));

const { deleteMyAccount, SELF_DELETE_FUNCTION } = await import('../accountErasure');

beforeEach(() => invoke.mockReset());

describe('deleteMyAccount', () => {
  it('confirms deletion and does not send an email target', async () => {
    invoke.mockResolvedValue({ data: { ok: true, geckos_deleted: 1, auth_user_deleted: true }, error: null });
    const result = await deleteMyAccount();
    expect(invoke).toHaveBeenCalledWith(SELF_DELETE_FUNCTION, { body: { confirm: 'DELETE' } });
    expect(result.auth_user_deleted).toBe(true);
  });
});

describe('delete-my-account function contract', () => {
  const source = readFileSync(
    resolve(__dirname, '../../../supabase/functions/delete-my-account/index.ts'),
    'utf8',
  );

  it('erases only the signed-in member and requires DELETE', () => {
    expect(source).toContain('body.confirm !== "DELETE"');
    expect(source).toContain('admin.auth.getUser(token)');
    expect(source).toContain('admin_erase_account');
    expect(source).not.toContain('body.email');
  });

  it('cancels a website subscription before the database erasure', () => {
    expect(source.indexOf('await cancelStripeSubscription')).toBeLessThan(source.indexOf('admin.rpc("admin_erase_account"'));
    expect(source).toContain('store_billing_continues: true');
  });
});
