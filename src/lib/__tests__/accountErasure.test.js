import { describe, it, expect, vi, beforeEach } from 'vitest';

const invoke = vi.fn();
vi.mock('@/lib/supabaseClient', () => ({
  supabase: { functions: { invoke: (...args) => invoke(...args) } },
}));

const { eraseAccount, readErasureError, erasureSummary, ERASURE_FUNCTION } = await import('../accountErasure');

function httpError(status, body) {
  const err = new Error('Edge Function returned a non-2xx status code');
  err.name = 'FunctionsHttpError';
  err.context = { status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) };
  return err;
}

beforeEach(() => invoke.mockReset());

describe('eraseAccount', () => {
  it('sends only the targets it was given', async () => {
    invoke.mockResolvedValue({ data: { ok: true, geckos_deleted: 2 }, error: null });
    const result = await eraseAccount({ supportMessageId: 's1' });
    expect(invoke).toHaveBeenCalledWith(ERASURE_FUNCTION, { body: { support_message_id: 's1' } });
    expect(result.geckos_deleted).toBe(2);
  });

  it('refuses to call the function with no target', async () => {
    await expect(eraseAccount({})).rejects.toMatchObject({ code: 'no_target' });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('says plainly when the function is not deployed', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(404, { code: 'NOT_FOUND', message: 'Requested function was not found' }),
    });
    await expect(eraseAccount({ email: 'a@b.com' })).rejects.toMatchObject({
      code: 'not_deployed',
      message: expect.stringContaining('not deployed yet'),
    });
  });

  it('treats an unreachable function as not deployed', async () => {
    const err = new Error('Failed to send a request to the Edge Function');
    err.name = 'FunctionsFetchError';
    invoke.mockResolvedValue({ data: null, error: err });
    await expect(eraseAccount({ email: 'a@b.com' })).rejects.toMatchObject({ code: 'not_deployed' });
  });

  it('passes the code and message from the function through', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(409, { error: 'active_subscription', message: 'Cancel it in Stripe first.' }),
    });
    await expect(eraseAccount({ profileId: 'p1' })).rejects.toMatchObject({
      code: 'active_subscription',
      message: 'Cancel it in Stripe first.',
      status: 409,
    });
  });

  it('reports a missing migration as its own code', async () => {
    const info = await readErasureError(
      httpError(503, { error: 'erasure_not_installed', message: 'The database part is not installed yet.' }),
    );
    expect(info).toEqual({ code: 'erasure_not_installed', message: 'The database part is not installed yet.', status: 503 });
  });
});

describe('erasureSummary', () => {
  it('describes what happened in one line', () => {
    expect(
      erasureSummary({
        geckos_deleted: 3, geckos_anonymised: 1, files_removed: 5, auth_user_deleted: true, tickets_closed: 1, files_failed: [],
      }),
    ).toBe("3 geckos deleted, 1 kept anonymised for other members' lineage, 5 files removed, login deleted, 1 deletion ticket closed.");
  });

  it('mentions files that could not be removed', () => {
    expect(erasureSummary({ geckos_deleted: 0, files_removed: 0, files_failed: ['a/b'] })).toContain('1 file could not be removed');
  });
});
