// @vitest-environment jsdom
// Most Admin Panel sections load when they open, not with the panel. This
// checks that a lazily loaded section shows a loading line and then the
// section, both when the panel opens on it (?section=) and when an admin
// picks it from the sidebar. The sections themselves are stand-ins here.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'a1', role: 'admin' }, isLoadingAuth: false }),
}));
vi.mock('@/lib/supabaseClient', () => {
  const query = {
    select: () => query,
    eq: () => query,
    then: (resolve, reject) => Promise.resolve({ count: 0 }).then(resolve, reject),
  };
  return { supabase: { from: () => query } };
});
vi.mock('@/components/admin/TestimonialsAdmin', () => ({ default: () => <p>Testimonials section</p> }));
vi.mock('@/components/admin/blog/BlogManager', () => ({ default: () => <p>Blog section</p> }));

import AdminPanel from '@/pages/AdminPanel';

installDomHarness();

const SLOW = { timeout: 15000 };
const TEST_TIMEOUT = 30000;

function renderPanel(search) {
  window.history.replaceState(null, '', `/AdminPanel${search}`);
  return render(
    <MemoryRouter initialEntries={[`/AdminPanel${search}`]}>
      <AdminPanel />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('Admin Panel sections that load on demand', () => {
  it('opens on a lazy section from the address, showing a loading line until it arrives', async () => {
    renderPanel('?section=testimonials');
    expect(screen.getByRole('heading', { name: 'Landing-page testimonials' })).toBeTruthy();
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(await screen.findByText('Testimonials section', {}, SLOW)).toBeTruthy();
    expect(screen.queryByText('Loading…')).toBeNull();
  }, TEST_TIMEOUT);

  it('loads a section picked from the sidebar', async () => {
    const user = userEvent.setup();
    renderPanel('?section=testimonials');
    await screen.findByText('Testimonials section', {}, SLOW);
    await user.click(screen.getByRole('button', { name: 'Blog' }));
    expect(screen.getByRole('heading', { name: 'Blog' })).toBeTruthy();
    expect(await screen.findByText('Blog section', {}, SLOW)).toBeTruthy();
  }, TEST_TIMEOUT);
});
