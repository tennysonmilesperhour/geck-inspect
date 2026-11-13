// The phone header shows the open page's name where the menu button used
// to be, and the wordmark on Today (experience review B6 and decision 6).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { HOME_PAGE, NAV_GROUPS, NAV_REGISTRY, navPagePath } from '@/lib/navItems';
import { phoneHeaderTitle } from '@/components/shared/phoneHeaderTitle';

describe('phoneHeaderTitle', () => {
  it('gives every menu page the name the menu uses', () => {
    const pages = NAV_GROUPS.flatMap((g) => g.pages);
    expect(pages).not.toContain(HOME_PAGE);
    for (const page of pages) {
      const label = NAV_REGISTRY.find((entry) => entry.page === page).sidebar.label;
      expect(phoneHeaderTitle(`/${page}`)).toBe(label);
      // The address the menu really opens (the calculator's is /calculator).
      expect(phoneHeaderTitle(navPagePath(page))).toBe(label);
    }
  });

  it('uses the one name each renamed page has (experience review H3)', () => {
    expect(phoneHeaderTitle('/Dashboard')).toBe('Overview');
    expect(phoneHeaderTitle('/Market')).toBe('Prices');
    expect(phoneHeaderTitle('/MarketplaceSalesStats')).toBe('Business');
    expect(phoneHeaderTitle('/Pedigree')).toBe('Family tree');
    expect(phoneHeaderTitle('/Gallery')).toBe('Community Gallery');
    expect(phoneHeaderTitle('/Lineage')).toBe('Lineage');
    expect(phoneHeaderTitle('/MyGeckos')).toBe('My Geckos');
    expect(phoneHeaderTitle('/calculator')).toBe('Genetics Calculator');
  });

  it('names Morph ID by its menu name, not its address', () => {
    expect(phoneHeaderTitle('/Recognition')).toBe('Morph ID');
  });

  it('uses the quick search name for a page that is not in the menu', () => {
    expect(phoneHeaderTitle('/Messages')).toBe('Messages');
    expect(phoneHeaderTitle('/Settings')).toBe('Settings');
    expect(phoneHeaderTitle('/FieldMode')).toBe('Field Mode');
  });

  it('reads only the first part of the address, in any letter case', () => {
    expect(phoneHeaderTitle('/GeckoDetail')).toBe('Gecko record');
    expect(phoneHeaderTitle('/calculator/learn')).toBe('Genetics Calculator');
    expect(phoneHeaderTitle('/mygeckos')).toBe(phoneHeaderTitle('/MyGeckos'));
  });

  it('returns null, for the wordmark, on Today, on the bare address and on a page with no name', () => {
    expect(phoneHeaderTitle('/Today')).toBeNull();
    expect(phoneHeaderTitle('/')).toBeNull();
    expect(phoneHeaderTitle('')).toBeNull();
    expect(phoneHeaderTitle('/SomethingNew')).toBeNull();
  });
});

// Layout.jsx is too large to render in a unit test, so the phone shell's
// promises are checked against its source, like phoneMenu.test.jsx does.
describe('the phone header and menu in Layout.jsx', () => {
  const layout = readFileSync(path.resolve(__dirname, '../../Layout.jsx'), 'utf8');
  const phoneHeader = layout.match(/<header ref=\{mobileHeaderRef\}[\s\S]*?<\/header>/)?.[0] || '';
  const laptopHeader = layout.match(/<header className="[^"]*hidden md:flex[\s\S]*?<\/header>/)?.[0] || '';
  const drawer = layout.match(/<Sidebar className=[\s\S]*?<\/Sidebar>/)?.[0] || '';

  it('the phone header has no menu button; it shows the title, search, Morph ID and the bell', () => {
    expect(phoneHeader).not.toBe('');
    expect(phoneHeader).not.toContain('toggleSidebar');
    expect(layout).not.toContain('Toggle Sidebar');
    expect(phoneHeader).toContain('{phoneTitle}');
    expect(phoneHeader).toContain('Geck Inspect');
    expect(phoneHeader).toContain('aria-label="Open quick search"');
    expect(phoneHeader).toMatch(/createPageUrl\("Recognition"\)[^>]*aria-label="Morph ID"/);
    expect(phoneHeader).toContain('<NotificationPopover');
  });

  it('Messages and Profile left the phone header only, and the phone bell carries the unread messages', () => {
    expect(phoneHeader).not.toContain('aria-label="Messages"');
    expect(phoneHeader).not.toContain('aria-label="Profile"');
    expect(phoneHeader).toContain('unreadMessages={unreadMessages}');
    expect(laptopHeader).toContain('aria-label="Messages"');
    expect(laptopHeader).toContain('aria-label="Profile"');
    expect(laptopHeader).not.toContain('unreadMessages={unreadMessages}');
  });

  it('a signed-out visitor and a guest both keep search and a way to an account', () => {
    expect(phoneHeader.match(/aria-label="Open quick search"/g)).toHaveLength(2);
    expect(phoneHeader).toContain('onClick={handleLogin}');
    expect(phoneHeader).toMatch(/isGuest && \(\s*<Link\s+to="\/AuthPortal\?mode=signup"/);
  });

  it('the phone menu is solid, says once that the demo saves nothing, and offers Send feedback', () => {
    expect(drawer).not.toBe('');
    const drawerClass = drawer.match(/<Sidebar className="([^"]*)"/)[1];
    expect(drawerClass).toContain('bg-slate-900');
    expect(drawerClass).not.toMatch(/bg-[a-z]+-\d+\/|backdrop-blur/);
    expect(drawer).toContain("{demoLine('mx-4 mt-3')}");
    expect(layout.match(/Demo: look around, nothing is saved\./g)).toHaveLength(1);
    expect(drawer).toContain("new CustomEvent('open_feedback')");
    expect(drawer).toContain('Send feedback');
  });

  it('the laptop sidebar says the same line once, in place of a "view only" pill on every item', () => {
    const sidebar = layout.slice(layout.indexOf('desktop-sidebar-wrapper'), layout.indexOf('<main id="main-content"'));
    expect(sidebar).toContain("{demoLine('sidebar-collapse-hide mx-4 mb-4')}");
    expect(layout).not.toMatch(/view only\s*<\/span>/);
    expect(layout).not.toContain('Guests can view this page but cannot save changes');
  });

  it('offers no way into the 24-step tour, shows no rank badge, and keeps "What\'s new" in both menus', () => {
    expect(layout).not.toContain('App Tutorial');
    expect(layout).not.toContain('setShowTutorial(true)}');
    expect(layout).not.toContain('<UserBadge');
    expect(layout).not.toContain('layoutConstants\';');
    expect(drawer).toContain('{renderWhatsNew()}');
    expect(layout).toContain("{renderWhatsNew('sidebar-collapse-hide')}");
    // The tour's code is kept and still opens on its event.
    expect(layout).toContain("window.addEventListener('open_tutorial', handler)");
    expect(layout).toContain('lazy(() => import("@/components/tutorial/TutorialModal"))');
  });

  it('hides the favourites grid and leaves saved favourites in the menu groups', () => {
    expect(layout).toContain('const SHOW_FAVORITES = false;');
    expect(layout).toContain('SHOW_FAVORITES && Array.isArray(user?.favorite_page_names)');
    expect(layout).toMatch(/hidden since 13 November 2026/);
  });

  it('mounts no floating feedback button for phones and keeps the notices in one stack', () => {
    const widget = readFileSync(path.resolve(__dirname, '../feedback/FeedbackWidget.jsx'), 'utf8');
    expect(widget).toMatch(/data-feedback-trigger\s+className="hidden md:flex /);
    expect(layout).toMatch(/<FloatingNoticeStack>[\s\S]*<FeedingAlertSystem[\s\S]*<GuestDemoGuide \/>[\s\S]*<\/FloatingNoticeStack>/);
  });
});
