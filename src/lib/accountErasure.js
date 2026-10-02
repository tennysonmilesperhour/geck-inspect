/**
 * eraseAccount, client wrapper for the `admin-delete-account` edge
 * function (admins only).
 *
 * The function deletes a member's data, anonymises the records other
 * members depend on (transfers, lineage, forum threads), removes their
 * photos from Storage, deletes their login and closes their deletion
 * request ticket. This wrapper turns every failure into an Error with a
 * plain `message` an admin can act on, and a `code`:
 *   'not_deployed'           the edge function is not deployed yet
 *   'erasure_not_installed'  the database migration is not applied yet
 *   'active_subscription'    cancel the member's Stripe subscription first
 *   'forbidden'              the caller is not an admin
 *   ...                      any other code the function returns
 */
import { supabase } from '@/lib/supabaseClient';

/** Subject of the ticket the Danger Zone files. The edge function and the
 *  database alert trigger match on this exact text. */
export const DELETION_REQUEST_SUBJECT = 'Account deletion request';

export const ERASURE_FUNCTION = 'admin-delete-account';

const NOT_DEPLOYED_MESSAGE =
  'Account erasure is not deployed yet. Deploy the admin-delete-account edge function and apply the account erasure migration, then try again. Nothing was deleted.';

/**
 * Read the error body a FunctionsHttpError hides on error.context and turn
 * it into { code, message, status }.
 */
export async function readErasureError(error) {
  const ctx = error?.context;
  const status = ctx && typeof ctx.status === 'number' ? ctx.status : null;
  let parsed = null;
  let text = '';
  if (ctx && typeof ctx.text === 'function') {
    try {
      text = await ctx.text();
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
  }

  // A function that was never deployed answers 404 from the gateway (its
  // body says NOT_FOUND, not one of our codes). A fetch or relay error
  // means the browser could not reach a function at all, which is also
  // what an undeployed function looks like when the preflight fails.
  const gatewayNotFound = status === 404 && (!parsed?.error || parsed?.code === 'NOT_FOUND');
  const unreachable = error?.name === 'FunctionsFetchError' || error?.name === 'FunctionsRelayError';
  if (gatewayNotFound || unreachable) {
    return { code: 'not_deployed', message: NOT_DEPLOYED_MESSAGE, status };
  }

  const code = parsed?.error || (status === 401 ? 'unauthenticated' : 'erasure_failed');
  const message = parsed?.message || parsed?.error || text || error?.message || 'Account erasure failed.';
  return { code, message, status };
}

/**
 * Erase one member's account. Pass the deletion request ticket id, the
 * profile id, the email, or several of them (they must agree).
 * Resolves with the function's summary; rejects with an Error that has
 * `code` and a plain-language `message`.
 */
export async function eraseAccount({ supportMessageId, profileId, email } = {}) {
  const body = {};
  if (supportMessageId) body.support_message_id = supportMessageId;
  if (profileId) body.profile_id = profileId;
  if (email) body.email = email;
  if (Object.keys(body).length === 0) {
    const err = new Error('Choose the account to erase.');
    err.code = 'no_target';
    throw err;
  }

  const { data, error } = await supabase.functions.invoke(ERASURE_FUNCTION, { body });
  if (error) {
    const info = await readErasureError(error);
    const err = new Error(info.message);
    err.code = info.code;
    err.status = info.status;
    throw err;
  }
  if (!data?.ok) {
    const err = new Error(data?.message || 'Account erasure did not finish.');
    err.code = data?.error || 'erasure_failed';
    throw err;
  }
  return data;
}

/** One line for a toast after a successful erasure. */
export function erasureSummary(result) {
  if (!result) return '';
  const parts = [
    `${result.geckos_deleted ?? 0} geckos deleted`,
    result.geckos_anonymised ? `${result.geckos_anonymised} kept anonymised for other members' lineage` : null,
    `${result.files_removed ?? 0} files removed`,
    result.auth_user_deleted ? 'login deleted' : 'no login found',
    result.tickets_closed
      ? `${result.tickets_closed} deletion ticket${result.tickets_closed === 1 ? '' : 's'} closed`
      : null,
  ].filter(Boolean);
  const failed = result.files_failed?.length
    ? ` ${result.files_failed.length} file${result.files_failed.length === 1 ? '' : 's'} could not be removed; see the ticket notes.`
    : '';
  return `${parts.join(', ')}.${failed}`;
}
