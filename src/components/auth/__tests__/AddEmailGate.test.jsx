// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fx = vi.hoisted(() => ({ updateUser: vi.fn(), refreshSession: vi.fn(), logout: vi.fn(), toasts: [] }));
vi.mock('@/lib/supabaseLazy', () => ({ getSupabase: async () => ({ auth: { updateUser: fx.updateUser, refreshSession: fx.refreshSession } }) }));
vi.mock('@/lib/nativeAuth', () => ({ authRedirect: (path) => `https://geckinspect.com${path}` }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ logout: fx.logout }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: (t) => fx.toasts.push(t) }) }));

import AddEmailGate from '../AddEmailGate';

beforeEach(() => { vi.clearAllMocks(); fx.toasts = []; });
afterEach(cleanup);

describe('AddEmailGate', () => {
  it('sends a confirmation link to the email typed in', async () => {
    fx.updateUser.mockResolvedValue({ error: null });
    render(<AddEmailGate />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: ' keeper@example.com ' } });
    fireEvent.click(screen.getByRole('button', { name: /send confirmation link/i }));
    await screen.findByText('keeper@example.com');
    expect(fx.updateUser).toHaveBeenCalledWith({ email: 'keeper@example.com' }, { emailRedirectTo: 'https://geckinspect.com/MyGeckos' });
  });

  it('says so when the email is not confirmed yet', async () => {
    fx.updateUser.mockResolvedValue({ error: null });
    fx.refreshSession.mockResolvedValue({ data: { user: { email: null } } });
    render(<AddEmailGate />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'keeper@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send confirmation link/i }));
    fireEvent.click(await screen.findByRole('button', { name: /i confirmed it/i }));
    await waitFor(() => expect(fx.toasts[0]?.title).toBe('Not confirmed yet'));
  });

  it('shows the error when the email cannot be used', async () => {
    fx.updateUser.mockResolvedValue({ error: new Error('A user with this email address has already been registered') });
    render(<AddEmailGate />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'taken@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send confirmation link/i }));
    await waitFor(() => expect(fx.toasts[0]?.description).toMatch(/already been registered/));
  });

  it('lets the member sign out', () => {
    render(<AddEmailGate />);
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(fx.logout).toHaveBeenCalled();
  });
});
