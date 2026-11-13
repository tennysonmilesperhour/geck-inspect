// @vitest-environment jsdom
// The quick search (experience review H4 and H6): no row twice, the
// breeding and selling pages hidden in Keeper mode with a line saying how
// to bring them back, and nothing that needs an account offered to a demo
// guest.
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';

const fx = vi.hoisted(() => ({ guest: false, signedOut: 0 }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { auth: { signOut: () => { fx.signedOut += 1; } } } }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ isGuest: fx.guest }) }));

import CommandPalette, { PALETTE_ACTIONS } from '../CommandPalette';
import { BREEDER_ONLY_PAGES, KEEPER_MODE_STORAGE_KEY, PALETTE_ITEMS } from '@/lib/navItems';

// cmdk measures its list and scrolls the selected row into view.
beforeAll(() => {
  globalThis.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView ||= () => {};
});

function Where() {
  const { pathname, search, hash } = useLocation();
  return <output data-testid="where">{pathname + search + hash}</output>;
}

function openSearch() {
  render(
    <MemoryRouter initialEntries={['/Today']}>
      <CommandPalette />
      <Where />
    </MemoryRouter>,
  );
  act(() => { window.dispatchEvent(new CustomEvent('open_command_palette')); });
}

const rows = () => screen.getAllByRole('option').map((el) => el.textContent);
const KEEPER_HINT = 'Breeding and selling pages are hidden in Keeper mode. Change it in Settings.';

beforeEach(() => {
  fx.guest = false;
  fx.signedOut = 0;
  localStorage.clear();
});
afterEach(cleanup);

describe('the quick search', () => {
  it('shows a member every page once, under one name, with the four actions', () => {
    openSearch();
    const shown = rows();
    expect(new Set(shown).size).toBe(shown.length);
    expect(shown).toEqual([...PALETTE_ACTIONS.map((a) => a.label), ...PALETTE_ITEMS.map((i) => i.label)]);
    for (const name of ['Overview', 'Prices', 'Business', 'Family tree', 'Genetics Calculator', 'Morph ID', 'Community Gallery', 'Sign out']) {
      expect(shown.filter((label) => label === name), name).toHaveLength(1);
    }
    // The second rows for Morph ID, the calculator and the Gallery are gone,
    // and so are the tour and the pages that are tabs of Prices.
    for (const gone of ['Identify morph with AI', 'Calculate a pairing (type it in the omnibox)', 'Browse community gallery', 'Open tutorial', 'Dashboard', 'Market Intelligence', 'Business Tools', 'Pedigree', 'Portfolio', 'Buy Geckos', 'Sell Geckos', 'Batch Husbandry']) {
      expect(shown, gone).not.toContain(gone);
    }
    expect(screen.queryByText(/hidden in Keeper mode/)).toBeNull();
  });

  it('still finds a page by a name it used to have', () => {
    openSearch();
    fireEvent.change(screen.getByPlaceholderText(/Search pages/), { target: { value: 'dashboard' } });
    expect(rows()).toEqual(['Overview']);
    fireEvent.change(screen.getByPlaceholderText(/Search pages/), { target: { value: 'market intelligence' } });
    expect(rows()).toEqual(['Prices']);
    fireEvent.change(screen.getByPlaceholderText(/Search pages/), { target: { value: 'portfolio' } });
    expect(rows()).toEqual(['Prices']);
    // Batch Husbandry is the log screen now, not a tool of its own.
    fireEvent.change(screen.getByPlaceholderText(/Search pages/), { target: { value: 'batch husbandry' } });
    expect(rows()).toEqual(['Log feeding']);
    fireEvent.click(screen.getByRole('option', { name: 'Log feeding' }));
    expect(screen.getByTestId('where').textContent).toBe('/log?type=feeding&all=1');
  });

  it('hides the breeding and selling pages in Keeper mode and says how to bring them back', () => {
    localStorage.setItem(KEEPER_MODE_STORAGE_KEY, '1');
    openSearch();
    const shown = rows();
    const hidden = PALETTE_ITEMS.filter((i) => BREEDER_ONLY_PAGES.has(i.page)).map((i) => i.label);
    expect(hidden).toEqual(expect.arrayContaining(['Breeding', 'Lineage', 'Genetics Calculator', 'Business', 'Prices']));
    for (const label of hidden) expect(shown, label).not.toContain(label);
    expect(shown).not.toContain('Reverse calculator: what makes my target morph?');
    for (const label of ['Add a new gecko', 'Log feeding', 'Today', 'Overview', 'My Geckos', 'Morph ID', 'Care Guide', 'Settings', 'Sign out']) {
      expect(shown, label).toContain(label);
    }
    expect(screen.getByText(/hidden in Keeper mode/).textContent).toBe(KEEPER_HINT);
    fireEvent.click(screen.getByRole('button', { name: 'Change it in Settings.' }));
    expect(screen.getByTestId('where').textContent).toBe('/Settings#keeper-mode');
  });

  it('follows Keeper mode when it is switched off in Settings', () => {
    localStorage.setItem(KEEPER_MODE_STORAGE_KEY, '1');
    openSearch();
    expect(rows()).not.toContain('Breeding');
    act(() => {
      localStorage.setItem(KEEPER_MODE_STORAGE_KEY, '0');
      window.dispatchEvent(new Event('keeper_mode_changed'));
    });
    expect(rows()).toContain('Breeding');
    expect(screen.queryByText(/hidden in Keeper mode/)).toBeNull();
  });

  it('does not offer a demo guest Sign out or the rows that need an account', () => {
    fx.guest = true;
    openSearch();
    const shown = rows();
    for (const label of ['Sign out', 'My Profile', 'My Store', 'Liked Geckos']) expect(shown, label).not.toContain(label);
    for (const label of ['Add a new gecko', 'Log feeding', 'Today', 'My Geckos', 'Breeding', 'Prices']) expect(shown, label).toContain(label);
  });

  it('opens the Genetics Calculator at its public address, and signs a member out', async () => {
    openSearch();
    fireEvent.click(screen.getByRole('option', { name: 'Genetics Calculator' }));
    expect(screen.getByTestId('where').textContent).toBe('/calculator');

    act(() => { window.dispatchEvent(new CustomEvent('open_command_palette')); });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('option', { name: 'Sign out' }));
    act(() => { vi.runAllTimers(); });
    vi.useRealTimers();
    expect(fx.signedOut).toBe(1);
  });
});
