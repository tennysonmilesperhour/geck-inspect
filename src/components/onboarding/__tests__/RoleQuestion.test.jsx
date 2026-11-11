// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fx = vi.hoisted(() => ({ saved: [], events: [] }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/lib/posthog', () => ({ captureEvent: (name, props) => fx.events.push([name, props]) }));
vi.mock('@/lib/onboardingState', async () => {
  const actual = await vi.importActual('@/lib/onboardingState');
  return { ...actual, saveOnboarding: (_client, email, patch) => { fx.saved.push([email, patch]); return Promise.resolve(true); } };
});

import RoleQuestionCard, { useRoleQuestion } from '../RoleQuestion';
import FirstGeckoStarter from '../FirstGeckoStarter';
import { KEEPER_MODE_STORAGE_KEY } from '@/lib/navItems';
import { MemoryRouter } from 'react-router-dom';

const NEW_MEMBER = { email: 'new@example.com', is_guest: false };

function Card({ user }) {
  const question = useRoleQuestion(user);
  return <RoleQuestionCard question={question} surface="my_geckos" />;
}

function Starter({ user, pendingName = null }) {
  const question = useRoleQuestion(user);
  return (
    <MemoryRouter>
      <FirstGeckoStarter surface="my_geckos" roleQuestion={question} onStart={() => {}} pendingName={pendingName} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  fx.saved = [];
  fx.events = [];
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(cleanup);

describe('the keeper-or-breeder question', () => {
  it('asks a member who never answered, and not a guest or an answered account', () => {
    render(<Card user={NEW_MEMBER} />);
    expect(screen.getByRole('heading', { name: 'How do you keep your crested geckos?' })).toBeTruthy();
    cleanup();

    render(<Card user={{ email: 'guest@local', is_guest: true }} />);
    expect(screen.queryByRole('heading', { name: 'How do you keep your crested geckos?' })).toBeNull();
    cleanup();

    render(<Card user={{ ...NEW_MEMBER, onboarding_completed_at: '2026-10-01T00:00:00Z' }} />);
    expect(screen.queryByRole('heading', { name: 'How do you keep your crested geckos?' })).toBeNull();
  });

  it('saves a keeper answer, turns Keeper mode on and stops asking', () => {
    const heard = vi.fn();
    window.addEventListener('keeper_mode_changed', heard);
    render(<Card user={NEW_MEMBER} />);
    fireEvent.click(screen.getByRole('button', { name: /I keep them as pets/ }));
    window.removeEventListener('keeper_mode_changed', heard);

    expect(fx.saved).toEqual([['new@example.com', { completed: true, role: 'keeper', keeperMode: true }]]);
    expect(localStorage.getItem(KEEPER_MODE_STORAGE_KEY)).toBe('1');
    expect(heard).toHaveBeenCalledTimes(1);
    expect(fx.events).toContainEqual(['onboarding_role_selected', { role: 'keeper', surface: 'my_geckos' }]);
    expect(screen.queryByRole('heading', { name: 'How do you keep your crested geckos?' })).toBeNull();
  });

  it('saves "a bit of both" as the full menu', () => {
    render(<Card user={NEW_MEMBER} />);
    fireEvent.click(screen.getByRole('button', { name: /A bit of both/ }));
    expect(fx.saved).toEqual([['new@example.com', { completed: true, role: 'breeder', keeperMode: false }]]);
    expect(localStorage.getItem(KEEPER_MODE_STORAGE_KEY)).toBe('0');
  });

  it('"Not now" hides it for this visit and saves nothing, so it is asked again next time', () => {
    render(<Card user={NEW_MEMBER} />);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('heading', { name: 'How do you keep your crested geckos?' })).toBeNull();
    expect(fx.saved).toEqual([]);
    cleanup();

    // The same visit: still hidden.
    render(<Card user={NEW_MEMBER} />);
    expect(screen.queryByRole('heading', { name: 'How do you keep your crested geckos?' })).toBeNull();
    cleanup();

    // A new visit (session storage starts empty): asked again.
    sessionStorage.clear();
    render(<Card user={NEW_MEMBER} />);
    expect(screen.getByRole('heading', { name: 'How do you keep your crested geckos?' })).toBeTruthy();
  });
});

describe('the first-gecko card', () => {
  it('opens on the question, then shows the ways to add a gecko', () => {
    render(<Starter user={NEW_MEMBER} />);
    expect(screen.getByRole('heading', { name: 'How do you keep your crested geckos?' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Type a name and morph/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /I breed them/ }));
    expect(screen.getByRole('heading', { name: 'Add your first gecko' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Type a name and morph/ })).toBeTruthy();
    expect(fx.saved).toEqual([['new@example.com', { completed: true, role: 'breeder', keeperMode: false }]]);
  });

  it('does not hold up a gecko waiting from the demo', () => {
    render(<Starter user={NEW_MEMBER} pendingName="Pumpkin" />);
    expect(screen.getByRole('heading', { name: 'Save Pumpkin to your collection' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'How do you keep your crested geckos?' })).toBeNull();
  });
});
