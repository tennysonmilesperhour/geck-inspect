import { useCallback, useEffect, useRef, useState } from 'react';

const same = (a, b) => {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
  return a === b;
};

const messageOf = (err) => (typeof err?.message === 'string' && err.message.trim()) || 'Please try again.';

/**
 * Settings saves each field as the member changes it (experience review
 * of 11 November 2026, finding F5). Before, one "Save changes" button
 * wrote the whole form, so a stale tab could overwrite a newer choice
 * and leaving the page lost everything typed.
 *
 * The rules this hook keeps:
 *  - a save carries one field and nothing else, so it can never write
 *    another field back with an old value;
 *  - saves go out one at a time, in the order the member made them;
 *  - while a field is saving, a newer choice for it waits and is sent
 *    next, so the last choice wins;
 *  - a failed save puts the control back to the saved value and keeps
 *    the choice so "Try again" can send it;
 *  - nothing is sent when `canSave()` says no (a guest, or no profile).
 *
 * `values` is what the controls show, `status[field]` is
 * { state: 'saving' | 'saved' | 'error', message }.
 */
export default function useSettingsAutosave({ save, canSave, validate, onSaved, savedMs = 2500 } = {}) {
  const [values, setValues] = useState({});
  const [status, setStatus] = useState({});
  const valuesRef = useRef({});
  const savedRef = useRef({});
  const busy = useRef(new Set()); // fields with a save on the wire
  const waiting = useRef(new Map()); // field -> newest value chosen while busy
  const failed = useRef(new Map()); // field -> the value a failed save tried
  const timers = useRef(new Map()); // field -> timer that clears the tick
  const tail = useRef(Promise.resolve()); // one save at a time
  const opts = useRef({});
  opts.current = { save, canSave, validate, onSaved };

  const show = useCallback((field, value) => {
    valuesRef.current = { ...valuesRef.current, [field]: value };
    setValues(valuesRef.current);
  }, []);

  const mark = useCallback((field, next) => {
    clearTimeout(timers.current.get(field));
    timers.current.delete(field);
    const drop = (prev) => {
      if (!(field in prev)) return prev;
      const rest = { ...prev };
      delete rest[field];
      return rest;
    };
    setStatus((prev) => (next ? { ...prev, [field]: next } : drop(prev)));
    if (next?.state === 'saved') {
      timers.current.set(field, setTimeout(() => {
        timers.current.delete(field);
        setStatus(drop);
      }, savedMs));
    }
  }, [savedMs]);

  const run = useCallback(async (field, value) => {
    busy.current.add(field);
    failed.current.delete(field);
    mark(field, { state: 'saving' });
    let failure = null;
    const attempt = tail.current.then(() => opts.current.save({ [field]: value }));
    tail.current = attempt.catch(() => {});
    try {
      await attempt;
    } catch (err) {
      failure = err || new Error('The save failed.');
    }
    busy.current.delete(field);
    if (!failure) {
      savedRef.current = { ...savedRef.current, [field]: value };
      opts.current.onSaved?.(field, value);
    }
    // The member moved this control again while the save was on the
    // wire: send the newest choice, or stop if it is what is saved.
    if (waiting.current.has(field)) {
      const next = waiting.current.get(field);
      waiting.current.delete(field);
      if (!same(next, savedRef.current[field])) return run(field, next);
      mark(field, failure ? null : { state: 'saved' });
      return undefined;
    }
    if (!failure) {
      mark(field, { state: 'saved' });
    } else if (same(valuesRef.current[field], value)) {
      failed.current.set(field, value);
      show(field, savedRef.current[field]);
      mark(field, { state: 'error', message: messageOf(failure), canRetry: true });
    } else {
      // The member is already typing something newer in this field. Leave
      // it alone; it is saved when focus leaves the field.
      mark(field, null);
    }
    return undefined;
  }, [mark, show]);

  /** Show `value` (or the current draft) for `field` and save it if it changed. */
  const commit = useCallback((field, value) => {
    const { canSave: allowed, validate: check } = opts.current;
    if (allowed && !allowed()) return false;
    let next = value === undefined ? valuesRef.current[field] : value;
    const saved = savedRef.current[field];
    if (check && !same(next, saved)) {
      const verdict = check(field, next, saved);
      if (verdict && typeof verdict.error === 'string') {
        failed.current.delete(field);
        show(field, saved);
        mark(field, { state: 'error', message: verdict.error, canRetry: false });
        return false;
      }
      if (verdict && 'value' in verdict) next = verdict.value;
    }
    show(field, next);
    if (busy.current.has(field)) {
      waiting.current.set(field, next);
      return true;
    }
    if (same(next, saved)) return false;
    run(field, next);
    return true;
  }, [mark, run, show]);

  /** Typing in a text field: show it, save nothing yet. */
  const setDraft = useCallback((field, value) => {
    show(field, value);
    // Typing again means the member has moved on from an earlier error.
    failed.current.delete(field);
    setStatus((prev) => {
      if (prev[field]?.state !== 'error') return prev;
      const rest = { ...prev };
      delete rest[field];
      return rest;
    });
  }, [show]);

  /** Send again the choice a failed save could not write. */
  const retry = useCallback((field) => {
    if (!failed.current.has(field)) return false;
    return commit(field, failed.current.get(field));
  }, [commit]);

  /** Save every draft that differs from what is saved (leaving the page). */
  const flush = useCallback(() => {
    for (const field of Object.keys(valuesRef.current)) {
      if (!busy.current.has(field) && !same(valuesRef.current[field], savedRef.current[field])) commit(field);
    }
  }, [commit]);

  /** Load the saved values (after the profile is read). */
  const reset = useCallback((initial) => {
    savedRef.current = { ...initial };
    valuesRef.current = { ...initial };
    waiting.current.clear();
    failed.current.clear();
    setValues(valuesRef.current);
    setStatus({});
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return { values, status, setDraft, commit, retry, flush, reset };
}
