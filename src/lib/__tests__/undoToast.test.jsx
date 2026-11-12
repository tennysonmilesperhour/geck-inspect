// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from '@/components/ui/toaster';
import { undoToast } from '@/lib/undoToast';

afterEach(cleanup);

describe('undoToast', () => {
  it('shows what happened with an Undo button, and runs undo once', async () => {
    const undo = vi.fn(async () => {});
    render(<Toaster />);
    act(() => { undoToast({ title: '2 eggs added', description: 'Onyx x Aria', undo, undone: 'Eggs removed' }); });

    expect(await screen.findByText('2 eggs added')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Undo' });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(undo).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Eggs removed')).toBeTruthy();
  });

  it('says so when the undo itself fails, instead of pretending', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Toaster />);
    act(() => { undoToast({ title: 'Plan deleted', undo: async () => { throw new Error('offline'); } }); });
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('That could not be undone')).toBeTruthy();
    quiet.mockRestore();
  });
});
