// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fx = vi.hoisted(() => ({ updateUser: vi.fn(), refreshSession: vi.fn(), signOut: vi.fn(), invoke: vi.fn(), logout: vi.fn(), toasts: [] }));
vi.mock('@/lib/supabaseLazy', () => ({ getSupabase: async () => ({ auth: { updateUser: fx.updateUser, refreshSession: fx.refreshSession, signOut: fx.signOut }, functions: { invoke: fx.invoke } }) }));
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
    fx.updateUser.mockResolvedValue({ error: new Error('Unable to validate email address: invalid format') });
    render(<AddEmailGate />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'taken@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send confirmation link/i }));
    await waitFor(() => expect(fx.toasts[0]?.description).toMatch(/invalid format/));
  });

  it('lets the member sign out', () => {
    render(<AddEmailGate />);
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(fx.logout).toHaveBeenCalled();
  });
});

describe('AddEmailGate, email already has an account', () => {
  it('removes the empty login and opens sign-in with the email ready', async () => {
    fx.updateUser.mockResolvedValue({ error: { code: 'email_exists', message: 'A user with this email address has already been registered' } });
    fx.invoke.mockResolvedValue({ data: { ok: true }, error: null });
    fx.signOut.mockResolvedValue({});
    const assign = vi.fn();
    Object.defineProperty(window, 'location', { value: { ...window.location, assign }, writable: true });
    render(<AddEmailGate />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'keeper@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send confirmation link/i }));
    fireEvent.click(await screen.findByRole('button', { name: /use my existing account/i }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/AuthPortal'));
    expect(fx.invoke).toHaveBeenCalledWith('discard-empty-account', { body: {} });
    expect(fx.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(sessionStorage.getItem('geck_signin_email')).toBe('keeper@example.com');
  });

  it('keeps the member signed in when the removal fails', async () => {
    fx.updateUser.mockResolvedValue({ error: { code: 'email_exists', message: 'taken' } });
    fx.invoke.mockResolvedValue({ data: null, error: new Error('Could not remove the empty sign-in. Try again.') });
    render(<AddEmailGate />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'keeper@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send confirmation link/i }));
    fireEvent.click(await screen.findByRole('button', { name: /use my existing account/i }));
    await waitFor(() => expect(fx.toasts[0]?.title).toBe('Could not switch accounts'));
    expect(fx.signOut).not.toHaveBeenCalled();
  });
});
