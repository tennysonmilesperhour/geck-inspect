/** Make one refund RPC attempt. A rejected or ambiguous call must not be retried:
 * the database function decrements a counter and is not idempotent.
 */
export async function refundMorphIdCreditOnce(
  call: () => Promise<{ data: unknown; error: unknown }>,
): Promise<boolean> {
  try {
    const { data, error } = await call();
    return !error && data != null;
  } catch {
    // The transaction may have committed before the response was lost.
    return false;
  }
}
