import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command as CommandPrimitive } from 'cmdk';
import {
  LayoutDashboard,
  Users,
  Images,
  MessageSquare,
  BookOpen,
  Dna,
  GitBranch,
  ShoppingCart,
  Bell,
  Settings,
  Heart,
  Mail,
  Sparkles,
  Trophy,
  FlaskConical,
  GraduationCap,
  FolderKanban,
  Search,
  Plus,
  LifeBuoy,
  LogOut,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

// Every row is { label, page, icon, keywords, section } so fuzzy search works
// on both the visible label and a list of synonyms.
const NAV_ITEMS = [
  // Collection
  { label: 'Dashboard',          page: 'Dashboard',          icon: LayoutDashboard, section: 'Your Collection', keywords: ['home', 'overview', 'stats'] },
  { label: 'My Geckos',          page: 'MyGeckos',           icon: Users,           section: 'Your Collection', keywords: ['collection', 'animals', 'list'] },
  { label: 'My Profile',         page: 'MyProfile',          icon: Users,           section: 'Your Collection', keywords: ['account', 'public profile'] },
  { label: 'Other Reptiles',     page: 'OtherReptiles',      icon: Users,           section: 'Your Collection', keywords: ['leopard gecko', 'other animals'] },

  // Breeding
  { label: 'Breeding Plans',     page: 'Breeding',           icon: GitBranch,       section: 'Breeding', keywords: ['pairings', 'projects', 'season'] },
  { label: 'Breeding Pairs',     page: 'BreedingPairs',      icon: GitBranch,       section: 'Breeding', keywords: ['sire dam', 'match', 'pair'] },
  { label: 'Lineage Tree',       page: 'Lineage',            icon: GitBranch,       section: 'Breeding', keywords: ['pedigree', 'family tree', 'ancestry'] },
  { label: 'Project Manager',    page: 'ProjectManager',     icon: FolderKanban,    section: 'Breeding', keywords: ['tasks', 'goals'] },
  { label: 'Genetic Calculator', page: 'GeneticCalculatorTool', icon: FlaskConical, section: 'Breeding', keywords: ['punnett', 'offspring', 'traits'] },

  // Community
  { label: 'Community Gallery',  page: 'Gallery',            icon: Images,          section: 'Community', keywords: ['photos', 'feed', 'browse'] },
  { label: 'Liked Geckos',       page: 'LikedGeckos',        icon: Heart,           section: 'Community', keywords: ['hearts', 'favorites'] },
  { label: 'Forum',              page: 'Forum',              icon: MessageSquare,   section: 'Community', keywords: ['discussion', 'posts'] },
  { label: 'Community Connect',  page: 'CommunityConnect',   icon: Users,           section: 'Community', keywords: ['social', 'directory'] },
  { label: 'Messages',           page: 'Messages',           icon: Mail,            section: 'Community', keywords: ['dm', 'inbox', 'chat'] },
  { label: 'Notifications',      page: 'Notifications',      icon: Bell,            section: 'Community', keywords: ['alerts'] },

  // Marketplace
  { label: 'Marketplace',        page: 'Marketplace',        icon: ShoppingCart,    section: 'Marketplace', keywords: ['buy', 'shop', 'store'] },
  { label: 'Buy Geckos',         page: 'MarketplaceBuy',     icon: ShoppingCart,    section: 'Marketplace', keywords: ['purchase', 'for sale'] },
  { label: 'Sell Geckos',        page: 'MarketplaceSell',    icon: ShoppingCart,    section: 'Marketplace', keywords: ['list', 'post'] },
  { label: 'My Listings',        page: 'MyListings',         icon: ShoppingCart,    section: 'Marketplace', keywords: ['my sales'] },

  // Reference
  { label: 'Morph Guide',        page: 'MorphGuide',         icon: Dna,             section: 'Reference', keywords: ['morphs', 'harlequin', 'dalmatian', 'lilly white'] },
  { label: 'Morph Visualizer',   page: 'MorphVisualizer',    icon: Sparkles,        section: 'Reference', keywords: ['simulator', 'preview'] },
  { label: 'Genetics Guide',     page: 'GeneticsGuide',      icon: Dna,             section: 'Reference', keywords: ['inheritance', 'heredity'] },
  { label: 'Care Guide',         page: 'CareGuide',          icon: BookOpen,        section: 'Reference', keywords: ['husbandry', 'care sheet', 'setup'] },
  { label: 'AI Morph Recognition', page: 'Recognition',      icon: Sparkles,        section: 'Reference', keywords: ['identify', 'classify', 'scan'] },
  { label: 'Train the AI Model', page: 'Training',           icon: GraduationCap,   section: 'Reference', keywords: ['label', 'tag', 'annotate'] },

  // Account
  { label: 'Settings',           page: 'Settings',           icon: Settings,        section: 'Account', keywords: ['preferences', 'config'] },
  { label: 'Subscription',       page: 'Subscription',       icon: Trophy,          section: 'Account', keywords: ['membership', 'billing'] },
];

// Shared row styling so every item looks the same whether it's an action
// or a navigation link.
const ITEM_CLASS =
  'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm text-slate-200 ' +
  'aria-selected:bg-emerald-500/15 aria-selected:text-emerald-100 ' +
  'aria-selected:border-l-2 aria-selected:border-emerald-400 ' +
  'transition-colors';

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Listen for a custom event so any button in the app can open the palette
  // (the header launcher dispatches 'open_command_palette' on click).
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open_command_palette', handler);
    return () => window.removeEventListener('open_command_palette', handler);
  }, []);

  const goTo = (page) => {
    setOpen(false);
    navigate(createPageUrl(page));
  };

  const runAction = (fn) => {
    setOpen(false);
    setTimeout(fn, 50);
  };

  // Group nav items by section for the palette
  const sections = NAV_ITEMS.reduce((acc, item) => {
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
              <CommandPrimitive.Group
                heading="Actions"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-slate-500"
              >
                <CommandPrimitive.Item
                  value="add gecko new gecko create"
                  onSelect={() => goTo('MyGeckos')}
                  className={ITEM_CLASS}
                >
                  <Plus className="h-4 w-4 text-emerald-400" />
                  <span>Add a new gecko</span>
                </CommandPrimitive.Item>
                <CommandPrimitive.Item
                  value="identify morph ai recognition classify"
                  onSelect={() => goTo('Recognition')}
                  className={ITEM_CLASS}
                >
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  <span>Identify morph with AI</span>
                </CommandPrimitive.Item>
                <CommandPrimitive.Item
                  value="tutorial help tour onboarding"
                  onSelect={() => runAction(() => window.dispatchEvent(new CustomEvent('open_tutorial')))}
                  className={ITEM_CLASS}
                >
                  <LifeBuoy className="h-4 w-4 text-emerald-400" />
                  <span>Open tutorial</span>
                </CommandPrimitive.Item>
                <CommandPrimitive.Item
                  value="search community gallery browse"
                  onSelect={() => goTo('Gallery')}
                  className={ITEM_CLASS}
                >
                  <Images className="h-4 w-4 text-emerald-400" />
                  <span>Browse community gallery</span>
                </CommandPrimitive.Item>
                <CommandPrimitive.Item
                  value="sign out log out logout"
                  onSelect={() => runAction(() => supabase.auth.signOut())}
                  className={ITEM_CLASS}
                >
                  <LogOut className="h-4 w-4 text-emerald-400" />
                  <span>Sign out</span>
                </CommandPrimitive.Item>
              </CommandPrimitive.Group>

              {/* Navigation, grouped by section */}
              {Object.entries(sections).map(([section, items]) => (
                <CommandPrimitive.Group
                  key={section}
                  heading={section}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-slate-500"
                >
                  {items.map((item) => {
                    const Icon = item.icon;
                    const searchable = [item.label, ...(item.keywords || [])].join(' ');
                    return (
                      <CommandPrimitive.Item
                        key={item.page}
                        value={searchable}
                        onSelect={() => goTo(item.page)}
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
          </CommandPrimitive>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
