/**
 * Sends the offline queue (src/lib/offlineQueue.js) once the connection is
 * back, and offers a hook for showing "N waiting to sync".
 */
import { useEffect, useState } from 'react';
import * as entities from '@/entities/all';
import { queryClientInstance } from '@/lib/query-client';
import { logFeedings, logShed } from '@/lib/husbandryLog';
import {
  enqueue,
  flushQueue,
  getQueueOwner,
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
export const FIELD_LOG = 'FieldLog';

export async function executeFieldLog(d) {
  if (!d?.geckoId) throw new Error('Offline log has no gecko');
  if (d.kind === 'fed') {
    return logFeedings({
      entries: [{ gecko: { id: d.geckoId, feeding_group_id: d.feedingGroupId || null }, accepted: d.accepted !== false }],
      date: d.date,
    });
  }
  if (d.kind === 'shed') {
    return logShed({ gecko: { id: d.geckoId }, date: d.date, quality: d.quality || 'unknown' });
  }
  if (d.kind === 'weight') {
    const record = await entities.WeightRecord.create({
      gecko_id: d.geckoId,
      weight_grams: d.grams,
      record_date: d.date,
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

export async function executeQueuedWrite(item) {
  if (item.entity === FIELD_LOG) return executeFieldLog(item.data);
  if (!ALLOWED_ENTITIES.has(item.entity)) throw new Error(`Unsupported entity ${item.entity}`);
  const client = entities[item.entity];
  if (item.op === 'create') return client.create(item.data);
  if (item.op === 'update') return client.update(item.recordId, item.data);
  if (item.op === 'delete') return client.delete(item.recordId);
  throw new Error(`Unsupported operation ${item.op}`);
}

/** Keep a whole Field Mode log for later. Returns the queue item. */
export function queueFieldLog(data) {
  return enqueue({ entity: FIELD_LOG, op: 'create', data });
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
