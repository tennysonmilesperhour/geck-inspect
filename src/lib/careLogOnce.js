// Saving a care log (weight, feeding, shed) exactly once.
//
// Why: the app gives up on a request after 30 seconds
// (src/lib/supabaseClient.js). On a weak signal the database can still
// receive and save the log after the phone has given up. The phone then
// keeps the log in the offline queue and sends it again later, which used
// to make a second weigh-in or a second feeding.
//
// The fix: every log gets a client request id, made once, before the first
// try, and kept with the queued copy. weight_records, feeding_records and
// shed_records each have a unique index on client_request_id
// (supabase/migrations/20261016100000_reminders_and_offline_logging.sql),
// so the second copy is refused. A refusal for that reason means "this log
// is already saved", and is treated as success.
//
// No imports on purpose: the entity client is passed in, so this is easy
// to test and safe to use from the offline queue.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A random version 4 UUID, the type of the client_request_id column. */
export function newClientRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isClientRequestId(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * True when the database refused a save because a log with the same
 * client request id is already there (Postgres error 23505 on the
 * client_request_id index), which means the earlier try got through.
 */
export function isDuplicateRequestError(error) {
  if (!error || String(error.code) !== '23505') return false;
  return /client_request_id/.test(`${error.message || ''} ${error.details || ''}`);
}

/**
 * Create one care record with its client request id. If the database says
 * that log is already saved, return the saved row instead of failing (or,
 * when the member cannot read it back, what was sent, marked duplicate).
 *
 *   client: an entity client with create() and filter() (WeightRecord, ...)
 *   record: the row; client_request_id is used when it is a valid id
 */
export async function createCareRecordOnce(client, record) {
  const requestId = isClientRequestId(record?.client_request_id) ? record.client_request_id : null;
  const row = { ...record };
  if (!requestId) delete row.client_request_id;
  try {
    return await client.create(row);
  } catch (error) {
    if (!requestId || !isDuplicateRequestError(error)) throw error;
    const rows = await Promise.resolve(client.filter({ client_request_id: requestId })).catch(() => []);
    return (Array.isArray(rows) && rows[0]) || { ...row, duplicate: true };
  }
}
