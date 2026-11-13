import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command as CommandPrimitive } from 'cmdk';
import {
  Sparkles,
  Search,
  Plus,
  LogOut,
  Utensils,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { KEEPER_MODE_STORAGE_KEY, PALETTE_ITEMS, paletteItemsFor } from '@/lib/navItems';

// The searchable page list (label, path, icon, section, keywords) is
// derived from the single NAV_REGISTRY in navItems.js so it can never drift
// from the sidebar. Each row's icon is already resolved to a component.
//
// The actions below are only things that are not a page of their own.
// "Identify morph with AI", "Calculate a pairing" and "Browse community
// gallery" were removed on 13 November 2026 (experience review H4): each
// was a second row for a page that is listed under its own name (Morph
// ID, Genetics Calculator, Community Gallery), and their words are now
// that row's keywords. "Open tutorial" left with the tour's other entry
// points (H8). "Log feeding" took the place of the Batch Husbandry row:
// that page is now the log screen, which this opens with every feeding
// group and gecko listed, and the old name still finds it. The same flags
// as the page rows decide who sees an action.
export const PALETTE_ACTIONS = [
  {
    id: 'add-gecko',
    label: 'Add a new gecko',
    value: 'add gecko new gecko create',
    icon: Plus,
    // ?add=1 opens the add form; plain /MyGeckos only showed the list.
    path: '/MyGeckos?add=1',
  },
  {
    id: 'log-feeding',
    label: 'Log feeding',
    value: 'log feeding fed feed mark all fed group rack bulk batch husbandry batch care',
    icon: Utensils,
    // The address /BatchHusbandry forwards to.
    path: '/log?type=feeding&all=1',
  },
  {
    id: 'reverse-calculator',
    label: 'Reverse calculator: what makes my target morph?',
    value: 'reverse calculator make me a target morph goal',
    icon: Sparkles,
    path: '/calculator/reverse',
    breederOnly: true,
  },
  {
    id: 'sign-out',
    label: 'Sign out',
    value: 'sign out log out logout',
    icon: LogOut,
    signOut: true,
    // A demo guest has no account to sign out of.
    memberOnly: true,
  },
];

const readKeeperMode = () => {
  try { return localStorage.getItem(KEEPER_MODE_STORAGE_KEY) === '1'; }
  catch { return false; }
};

// Shared row styling so every item looks the same whether it's an action
// or a navigation link.
const ITEM_CLASS =
  'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm text-slate-200 ' +
  'aria-selected:bg-emerald-500/15 aria-selected:text-emerald-100 ' +
  'aria-selected:border-l-2 aria-selected:border-emerald-400 ' +
  'transition-colors';

const GROUP_CLASS =
  '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] ' +
  '[&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase ' +
  '[&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-slate-500';

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [keeperMode, setKeeperMode] = useState(readKeeperMode);
  const { isGuest } = useAuth();
  const navigate = useNavigate();

  // Listen for a custom event so any button in the app can open the palette
  // (the header launcher dispatches 'open_command_palette' on click), and
  // support the standard Cmd+K / Ctrl+K keyboard shortcut from anywhere.
  useEffect(() => {
    const handler = () => setOpen(true);
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('open_command_palette', handler);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('open_command_palette', handler);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // Keeper mode is kept per device (Settings writes it and fires
  // 'keeper_mode_changed'; a sign-in can copy it from the profile), so it
  // is read again each time the search opens.
  useEffect(() => {
    const sync = () => setKeeperMode(readKeeperMode());
    if (open) sync();
    window.addEventListener('keeper_mode_changed', sync);
    return () => window.removeEventListener('keeper_mode_changed', sync);
  }, [open]);

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  const runAction = (fn) => {
    setOpen(false);
    setTimeout(fn, 50);
  };

  // Keeper mode hides the breeding and selling rows, as it does in the
  // menu, and a demo guest is not offered what needs an account.
  const viewer = { keeperMode, guest: Boolean(isGuest) };
  const actions = paletteItemsFor(viewer, PALETTE_ACTIONS);

  // Group nav items by section for the palette
  const sections = paletteItemsFor(viewer, PALETTE_ITEMS).reduce((acc, item) => {
    (acc[item.section] ||= []).push(item);
    return acc;
  }, {});

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[12%] z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-emerald-500/10 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="sr-only">Quick search</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search pages and actions in Geck Inspect
          </DialogPrimitive.Description>

          <CommandPrimitive
            className="flex h-full w-full flex-col"
            filter={(value, search) => {
              if (!search) return 1;
              return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            {/* Input */}
            <div className="flex items-center gap-3 border-b border-slate-700/70 px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <CommandPrimitive.Input
                placeholder="Search pages, actions, or shortcuts…"
                className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-500 outline-none text-sm"
                autoFocus
              />
            </div>

            {/* Results */}
            <CommandPrimitive.List className="max-h-[60vh] overflow-y-auto p-2">
              <CommandPrimitive.Empty className="py-10 text-center text-sm text-slate-500">
                No results found.
              </CommandPrimitive.Empty>

              {/* Quick actions */}
              <CommandPrimitive.Group heading="Actions" className={`[&_[cmdk-group-heading]]:pt-2 ${GROUP_CLASS}`}>
                {actions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <CommandPrimitive.Item
                      key={action.id}
                      value={`${action.label} ${action.value}`}
                      onSelect={() => (action.signOut ? runAction(() => supabase.auth.signOut()) : go(action.path))}
                      className={ITEM_CLASS}
                    >
                      <Icon className="h-4 w-4 text-emerald-400" />
                      <span>{action.label}</span>
                    </CommandPrimitive.Item>
                  );
                })}
              </CommandPrimitive.Group>

              {/* Navigation, grouped by section */}
              {Object.entries(sections).map(([section, items]) => (
                <CommandPrimitive.Group
                  key={section}
                  heading={section}
                  className={`[&_[cmdk-group-heading]]:pt-3 ${GROUP_CLASS}`}
                >
                  {items.map((item) => {
                    const Icon = item.icon;
                    const searchable = [item.label, ...(item.keywords || [])].join(' ');
                    return (
                      <CommandPrimitive.Item
                        key={item.page}
                        value={searchable}
                        onSelect={() => go(item.path)}
                        className={ITEM_CLASS}
                      >
                        <Icon className="h-4 w-4 text-slate-400" />
                        <span>{item.label}</span>
                      </CommandPrimitive.Item>
                    );
                  })}
                </CommandPrimitive.Group>
              ))}
            </CommandPrimitive.List>

            {/* A keeper can still reach every page: this says where the
                hidden ones went and how to bring them back. */}
            {keeperMode && (
              <p className="border-t border-slate-700/70 px-4 py-3 text-xs text-slate-400">
                Breeding and selling pages are hidden in Keeper mode.{' '}
                <button
                  type="button"
                  onClick={() => go('/Settings#keeper-mode')}
                  className="relative touch-hit font-medium text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
                >
                  Change it in Settings.
                </button>
              </p>
            )}
          </CommandPrimitive>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
