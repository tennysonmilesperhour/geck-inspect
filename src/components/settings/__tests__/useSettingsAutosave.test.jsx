// @vitest-environment jsdom
// Settings saves each field as it changes (finding F5). These hold the
// rules that make that safe: one field per save, saves in order, the
// last choice wins, a failed save puts the control back, and a guest
// never saves.
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import useSettingsAutosave from '@/components/settings/useSettingsAutosave';

// A save the test settles by hand, so it can look at the "saving" state.
function manualSave() {
  const calls = [];
  const save = (patch) => new Promise((resolve, reject) => {
    calls.push({ patch, resolve, reject });
  });
  return { calls, save };
}

const start = (options, initial = { bio: 'old', city: 'Portland', is_public_profile: true, kinds: ['a', 'b'] }) => {
  const view = renderHook(() => useSettingsAutosave(options));
  act(() => view.result.current.reset(initial));
  return view;
};

describe('useSettingsAutosave', () => {
  it('sends only the field that changed, and shows Saved after', async () => {
    const { calls, save } = manualSave();
    const { result } = start({ save });
    act(() => { result.current.commit('is_public_profile', false); });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].patch).toEqual({ is_public_profile: false });
    expect(result.current.values.is_public_profile).toBe(false);
    expect(result.current.status.is_public_profile).toEqual({ state: 'saving' });
    await act(async () => { calls[0].resolve(); });
    expect(result.current.status.is_public_profile).toEqual({ state: 'saved' });
  });

  it('typing saves nothing until the field is committed, and an unchanged field is not sent', async () => {
    const { calls, save } = manualSave();
    const { result } = start({ save });
    act(() => { result.current.setDraft('bio', 'new'); });
    expect(result.current.values.bio).toBe('new');
    expect(calls).toHaveLength(0);
    act(() => { result.current.commit('city'); });
    expect(calls).toHaveLength(0);
    act(() => { result.current.commit('bio'); });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].patch).toEqual({ bio: 'new' });
  });

  it('saves go out one at a time, in the order they were made', async () => {
    const { calls, save } = manualSave();
    const { result } = start({ save });
    act(() => {
      result.current.commit('bio', 'first');
      result.current.commit('city', 'Salem');
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].patch).toEqual({ bio: 'first' });
    await act(async () => { calls[0].resolve(); });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1].patch).toEqual({ city: 'Salem' });
  });

  it('a newer choice made while the field is saving is sent next: the last choice wins', async () => {
    const { calls, save } = manualSave();
    const { result } = start({ save });
    act(() => { result.current.commit('kinds', ['a']); });
    await waitFor(() => expect(calls).toHaveLength(1));
    act(() => { result.current.commit('kinds', []); });
    expect(calls).toHaveLength(1);
    await act(async () => { calls[0].resolve(); });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1].patch).toEqual({ kinds: [] });
    await act(async () => { calls[1].resolve(); });
    expect(result.current.values.kinds).toEqual([]);
    expect(result.current.status.kinds).toEqual({ state: 'saved' });
  });

  it('a failed save puts the control back and keeps the choice for Try again', async () => {
    const { calls, save } = manualSave();
    const { result } = start({ save });
    act(() => { result.current.commit('is_public_profile', false); });
    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => { calls[0].reject(new Error('network down')); });
    expect(result.current.values.is_public_profile).toBe(true);
    expect(result.current.status.is_public_profile).toEqual({ state: 'error', message: 'network down', canRetry: true });
    act(() => { result.current.retry('is_public_profile'); });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1].patch).toEqual({ is_public_profile: false });
    await act(async () => { calls[1].resolve(); });
    expect(result.current.values.is_public_profile).toBe(false);
    expect(result.current.status.is_public_profile).toEqual({ state: 'saved' });
  });

  it('a save that fails does not stop the next field from saving', async () => {
    const { calls, save } = manualSave();
    const { result } = start({ save });
    act(() => {
      result.current.commit('bio', 'first');
      result.current.commit('city', 'Salem');
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => { calls[0].reject(new Error('no')); });
    await waitFor(() => expect(calls).toHaveLength(2));
    await act(async () => { calls[1].resolve(); });
    expect(result.current.values).toMatchObject({ bio: 'old', city: 'Salem' });
  });

  it('never saves when canSave says no (a guest)', async () => {
    const { calls, save } = manualSave();
    const { result } = start({ save, canSave: () => false });
    act(() => {
      result.current.commit('is_public_profile', false);
      result.current.setDraft('bio', 'typed');
      result.current.flush();
    });
    await Promise.resolve();
    expect(calls).toHaveLength(0);
    expect(result.current.values.is_public_profile).toBe(true);
  });

  it('validate can tidy a value or refuse it; a refused value goes back with the reason', async () => {
    const { calls, save } = manualSave();
    const validate = (field, value) => {
      if (field !== 'bio') return null;
      return value.trim() ? { value: value.trim() } : { error: 'Needed.' };
    };
    const { result } = start({ save, validate });
    act(() => { result.current.commit('bio', '   '); });
    expect(calls).toHaveLength(0);
    expect(result.current.values.bio).toBe('old');
    expect(result.current.status.bio).toEqual({ state: 'error', message: 'Needed.', canRetry: false });
    // Typing again clears the message.
    act(() => { result.current.setDraft('bio', ' new '); });
    expect(result.current.status.bio).toBeUndefined();
    act(() => { result.current.commit('bio'); });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].patch).toEqual({ bio: 'new' });
  });

  it('flush sends every typed draft (leaving the page), and only those', async () => {
    const { calls, save } = manualSave();
    const { result } = start({ save });
    act(() => {
      result.current.setDraft('bio', 'typed');
      result.current.flush();
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].patch).toEqual({ bio: 'typed' });
  });

  it('tells the page what was saved', async () => {
    const { calls, save } = manualSave();
    const seen = [];
    const { result } = start({ save, onSaved: (field, value) => seen.push([field, value]) });
    act(() => { result.current.commit('city', 'Salem'); });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(seen).toEqual([]);
    await act(async () => { calls[0].resolve(); });
    expect(seen).toEqual([['city', 'Salem']]);
  });
});
