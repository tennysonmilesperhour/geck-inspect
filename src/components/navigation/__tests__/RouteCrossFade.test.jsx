// @vitest-environment jsdom
// Moves between screens inside the signed-in shell cross-fade (experience
// review L1). RouteCrossFade does it by wrapping the router's push, so
// these tests use real links and navigate() under a real router.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';
import RouteCrossFade, { leavesScreen } from '../RouteCrossFade';

installDomHarness();

// The browser's side of a view transition: it keeps the callback until it
// has its picture of the old screen. The test plays the browser.
let callbacks;
let reduced;

beforeEach(() => {
  callbacks = [];
  reduced = false;
  document.startViewTransition = vi.fn((callback) => {
    callbacks.push(callback);
    return { ready: Promise.resolve(), finished: Promise.resolve() };
  });
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: reduced && query.includes('reduce'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => {
  delete document.startViewTransition;
  vi.restoreAllMocks();
});

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function Shell() {
  const navigate = useNavigate();
  return (
    <>
      <Where />
      <Link to="/MyGeckos">Geckos</Link>
      <Link to="/Today?view=week">This week</Link>
      <button type="button" onClick={() => navigate('/log')}>Log</button>
      <button type="button" onClick={() => navigate('/Settings', { replace: true })}>Redirect</button>
      <button type="button" onClick={() => navigate(-1)}>Back</button>
    </>
  );
}

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/Today']}>
      <RouteCrossFade>
        <Routes>
          <Route path="*" element={<Shell />} />
        </Routes>
      </RouteCrossFade>
    </MemoryRouter>,
  );
}

const where = () => screen.getByTestId('where').textContent;
// Plays the browser: runs the change it was handed and waits for the new
// screen, as the fade does.
const takePicture = (index = 0) => act(async () => { await callbacks[index](); });

describe('RouteCrossFade', () => {
  it('a link to another screen moves inside a view transition', async () => {
    renderShell();
    fireEvent.click(screen.getByRole('link', { name: 'Geckos' }));
    expect(document.startViewTransition).toHaveBeenCalledTimes(1);
    // The move waits for the picture of the old screen, then lands.
    expect(where()).toBe('/Today');
    await takePicture();
    expect(where()).toBe('/MyGeckos');
  });

  it('navigate() from a page fades the same way', async () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    expect(document.startViewTransition).toHaveBeenCalledTimes(1);
    await takePicture();
    expect(where()).toBe('/log');
  });

  it('the fade is told when the new screen is drawn, and not before', async () => {
    renderShell();
    fireEvent.click(screen.getByRole('link', { name: 'Geckos' }));
    let drawn = false;
    let waiting;
    await act(async () => {
      waiting = callbacks[0]().then(() => { drawn = true; });
    });
    await act(async () => { await waiting; });
    expect(drawn).toBe(true);
    expect(where()).toBe('/MyGeckos');
  });

  it('a change of only the part after "?" stays on the screen and does not fade', () => {
    renderShell();
    fireEvent.click(screen.getByRole('link', { name: 'This week' }));
    expect(document.startViewTransition).not.toHaveBeenCalled();
    expect(where()).toBe('/Today?view=week');
  });

  it('redirects and Back are left alone', async () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Redirect' }));
    expect(document.startViewTransition).not.toHaveBeenCalled();
    expect(where()).toBe('/Settings');

    fireEvent.click(screen.getByRole('link', { name: 'Geckos' }));
    await takePicture();
    expect(where()).toBe('/MyGeckos');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Back' })); });
    expect(document.startViewTransition).toHaveBeenCalledTimes(1);
    expect(where()).toBe('/Settings');
  });

  it('a redirect that follows a move lands after it, not before', async () => {
    renderShell();
    fireEvent.click(screen.getByRole('link', { name: 'Geckos' }));
    // Still waiting for the picture when the redirect comes.
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Redirect' })); });
    expect(where()).toBe('/Settings');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Back' })); });
    // /MyGeckos was replaced by /Settings, so Back is the first screen.
    expect(where()).toBe('/Today');
  });

  it('does nothing different under reduced motion', () => {
    reduced = true;
    renderShell();
    fireEvent.click(screen.getByRole('link', { name: 'Geckos' }));
    expect(document.startViewTransition).not.toHaveBeenCalled();
    expect(where()).toBe('/MyGeckos');
  });

  it('does nothing different in a browser without view transitions', () => {
    delete document.startViewTransition;
    renderShell();
    fireEvent.click(screen.getByRole('link', { name: 'Geckos' }));
    expect(where()).toBe('/MyGeckos');
  });
});

describe('leavesScreen', () => {
  it('compares the page part of the address only', () => {
    expect(leavesScreen({ pathname: '/MyGeckos', search: '' }, '/Today')).toBe(true);
    expect(leavesScreen({ pathname: '/Today', search: '?view=week' }, '/Today')).toBe(false);
    expect(leavesScreen('/log?type=weight', '/log')).toBe(false);
    expect(leavesScreen('/MyGeckos#top', '/Today')).toBe(true);
    // The router matches pages whatever the case or trailing slash.
    expect(leavesScreen({ pathname: '/mygeckos/' }, '/MyGeckos')).toBe(false);
    expect(leavesScreen({ search: '?tab=feeding' }, '/Today')).toBe(false);
  });
});
