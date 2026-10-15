/**
 * Sends the offline queue (src/lib/offlineQueue.js) once the connection is
 * back, and offers a hook for showing "N waiting to sync".
 */
import { useEffect, useState } from 'react';
import * as entities from '@/entities/all';
import { queryClientInstance } from '@/lib/query-client';
import { logFeedings, logShed } from '@/lib/husbandryLog';
import { createCareRecordOnce, isClientRequestId, newClientRequestId } from '@/lib/careLogOnce';
import {
  enqueue,
  flushQueue,
  getQueueOwner,
  isAuthError,
  isNetworkError,
  pendingCount,
  subscribeQueue,
} from '@/lib/offlineQueue';

// Only the writes Field Mode makes. Anything else is refused by name so a
// damaged queue entry can never call an arbitrary entity method.
const ALLOWED_ENTITIES = new Set(['FeedingRecord', 'ShedRecord', 'WeightRecord', 'GeckoEvent', 'Gecko']);

// A whole Field Mode log kept offline. It replays through the same shared
// log (src/lib/husbandryLog.js) as an online log, so a feeding made with no
// signal still writes the per-gecko record on its own (possibly backdated)
// day and moves the feeding group schedule when the gecko ate (D21; a group
// is never moved back in time).
//
// Weight, feeding and shed logs carry `requestId`, made once before the
// first try and kept in the queue, so a log the server saved after the
// phone gave up is not saved a second time on replay (careLogOnce.js).
// Logs queued by an older version of the app have none and replay as
// before.
export const FIELD_LOG = 'FieldLog';

export async function executeFieldLog(d) {
  if (!d?.geckoId) throw new Error('Offline log has no gecko');
  const requestId = isClientRequestId(d.requestId) ? d.requestId : null;
  if (d.kind === 'fed') {
    return logFeedings({
      entries: [{
        gecko: { id: d.geckoId, feeding_group_id: d.feedingGroupId || null },
        accepted: d.accepted !== false,
        ...(requestId ? { clientRequestId: requestId } : {}),
      }],
      date: d.date,
    });
  }
  if (d.kind === 'shed') {
    return logShed({
      gecko: { id: d.geckoId },
      date: d.date,
      quality: d.quality || 'unknown',
      ...(requestId ? { clientRequestId: requestId } : {}),
    });
  }
  if (d.kind === 'weight') {
    const record = await createCareRecordOnce(entities.WeightRecord, {
      gecko_id: d.geckoId,
      weight_grams: d.grams,
      record_date: d.date,
      ...(requestId ? { client_request_id: requestId } : {}),
    });
    if (d.mirror) await entities.Gecko.update(d.geckoId, { weight_grams: d.grams });
    return record;
  }
  if (d.kind === 'note') {
    return entities.GeckoEvent.create({
      gecko_id: d.geckoId,
      event_type: 'custom',
      custom_event_name: 'Field note',
      event_date: d.eventDate,
      notes: d.notes,
    });
  }
  throw new Error(`Unsupported offline log ${d.kind}`);
}

// Entities whose rows have a client_request_id column.
const CARE_ENTITIES = new Set(['FeedingRecord', 'ShedRecord', 'WeightRecord']);

export async function executeQueuedWrite(item) {
  if (item.entity === FIELD_LOG) return executeFieldLog(item.data);
  if (!ALLOWED_ENTITIES.has(item.entity)) throw new Error(`Unsupported entity ${item.entity}`);
  const client = entities[item.entity];
  if (item.op === 'create' && CARE_ENTITIES.has(item.entity)) return createCareRecordOnce(client, item.data);
  if (item.op === 'create') return client.create(item.data);
  if (item.op === 'update') return client.update(item.recordId, item.data);
  if (item.op === 'delete') return client.delete(item.recordId);
  throw new Error(`Unsupported operation ${item.op}`);
}

// Field logs that write a care record, and so get a request id.
const CARE_KINDS = new Set(['fed', 'shed', 'weight']);

/**
 * A Field Mode log ready to save or keep: weight, feeding and shed logs
 * get their request id here unless they already have one.
 */
export function prepareFieldLog(data) {
  if (!data || !CARE_KINDS.has(data.kind) || isClientRequestId(data.requestId)) return data;
  return { ...data, requestId: newClientRequestId() };
}

/** Keep a whole Field Mode log for later. Returns the queue item. */
export function queueFieldLog(data) {
  return enqueue({ entity: FIELD_LOG, op: 'create', data: prepareFieldLog(data) });
}

/**
 * Save one Field Mode log now, or keep it on the phone when there is no
 * connection. The same request id is used for the try and for the queued
 * copy, so a try that reached the server but timed out on the phone is
 * not saved twice when the queue sends it.
 *
 * Resolves to { result, queued, data }: `result` is what the save returned
 * (null when queued), `queued` the queue item (null when saved now). An
 * expired sign-in or a refusal from the database is thrown, not queued.
 */
export async function saveFieldLog(data, { offline = isDeviceOffline() } = {}) {
  const prepared = prepareFieldLog(data);
  if (offline) return { result: null, queued: queueFieldLog(prepared), data: prepared };
  try {
    const result = await executeFieldLog(prepared);
    return { result, queued: null, data: prepared };
  } catch (error) {
    if (!isNetworkError(error) || isAuthError(error)) throw error;
    return { result: null, queued: queueFieldLog(prepared), data: prepared };
  }
}

/** True when the phone says it has no connection. */
export function isDeviceOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Try the write now; if there is no connection, keep it for later.
 * Resolves to { record, queued } where `queued` is the queue item when the
 * write was kept on the device.
 */
export async function writeOrQueue({ entity, op, data = null, recordId = null, forceQueue = false }) {
  const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
  // A new care record gets its request id before the first try, so the
  // queued copy carries the same one (see careLogOnce.js).
  if (op === 'create' && CARE_ENTITIES.has(entity) && data && !isClientRequestId(data.client_request_id)) {
    data = { ...data, client_request_id: newClientRequestId() };
  }
  // forceQueue: an earlier write in the same log is already waiting, so
  // this one waits behind it (the queue replays in order).
  if (isOnline && !forceQueue) {
    try {
      const record = await executeQueuedWrite({ entity, op, data, recordId });
      return { record, queued: null };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  return { record: null, queued: enqueue({ entity, op, data, recordId }) };
}

let syncing = false;

/** Send everything waiting. Returns flushQueue's result, or null. */
export async function syncNow() {
  if (!getQueueOwner() || pendingCount() === 0) return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  syncing = true;
  try {
    const result = await flushQueue(executeQueuedWrite);
    if (result.saved > 0) {
      // Pages showing the collection pick up the synced logs.
      queryClientInstance.invalidateQueries({ queryKey: ['my-geckos'] });
      queryClientInstance.invalidateQueries({ queryKey: ['field-mode'] });
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('geckos_changed'));
    }
    return result;
  } finally {
    syncing = false;
  }
}

export function isSyncing() {
  return syncing;
}

/** Live { pending, online } for the offline status display. */
export function useOfflineQueue() {
  const [pending, setPending] = useState(() => pendingCount());
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    setPending(pendingCount());
    const unsub = subscribeQueue(setPending);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      unsub();
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return { pending, online };
}
