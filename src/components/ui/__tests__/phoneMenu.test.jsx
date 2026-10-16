// @vitest-environment jsdom
// The phone tab bar's More tab opens the full menu as a sheet. A screen
// reader user hears what the tab opens ("More: open the full menu"),
// whether it is open, and a name for the sheet once it is ("Menu").
import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';
import { MOBILE_MENU_ID, Sidebar, SidebarProvider, useSidebar } from '@/components/ui/Sidebar';

installDomHarness();

// The More tab as Layout.jsx draws it (the attributes are checked against
// Layout.jsx below, so the two cannot drift apart).
function MoreTab() {
  const { toggleSidebar, isMobileOpen } = useSidebar();
  return (
    <button
      type="button"
      onClick={() => toggleSidebar()}
      aria-label="More: open the full menu"
      aria-haspopup="dialog"
      aria-expanded={isMobileOpen}
      aria-controls={MOBILE_MENU_ID}
    >
      More
    </button>
  );
}

function renderMenu() {
  return render(
    <MemoryRouter>
      <SidebarProvider>
        <Sidebar>
          <a href="/MyGeckos">My Geckos</a>
        </Sidebar>
        <MoreTab />
      </SidebarProvider>
    </MemoryRouter>,
  );
}

describe('the More tab and its menu sheet', () => {
  it('says what it opens, and that the sheet is closed', () => {
    renderMenu();
    const more = screen.getByRole('button', { name: 'More: open the full menu' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(more.getAttribute('aria-haspopup')).toBe('dialog');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a sheet named "Menu" that the tab points to', async () => {
    renderMenu();
    const more = screen.getByRole('button', { name: 'More: open the full menu' });
    await userEvent.click(more);
    const sheet = screen.getByRole('dialog', { name: 'Menu' });
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(sheet.id).toBe(MOBILE_MENU_ID);
    expect(more.getAttribute('aria-controls')).toBe(sheet.id);
    expect(more.getAttribute('aria-expanded')).toBe('true');
  });

  it('is drawn this way in Layout.jsx', () => {
    const layout = readFileSync(path.resolve(__dirname, '../../../Layout.jsx'), 'utf8');
    const tab = layout.match(/const isLog = tab\.action === 'log';[\s\S]*?<\/button>/)?.[0] || '';
    expect(tab).toContain("'More: open the full menu'");
    expect(tab).toContain('aria-haspopup="dialog"');
    expect(tab).toContain('aria-expanded={isLog ? logSheetOpen : isMobileOpen}');
    expect(tab).toContain('aria-controls={isLog ? undefined : MOBILE_MENU_ID}');
  });
});
