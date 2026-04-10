import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from '@/components/ui/command';
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
  CalendarDays,
  Egg,
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

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Bind Ctrl/Cmd+K globally
  useEffect(() => {
    const down = (e) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Listen for a custom event so other components (e.g., a sidebar
  // "search" button) can open the palette without having to share state.
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
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, actions, or shortcuts…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Quick actions first */}
        <CommandGroup heading="Actions">
          <CommandItem
            value="add gecko new gecko create"
            onSelect={() => goTo('MyGeckos')}
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>Add a new gecko</span>
          </CommandItem>
          <CommandItem
            value="identify morph ai recognition classify"
            onSelect={() => goTo('Recognition')}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            <span>Identify morph with AI</span>
          </CommandItem>
          <CommandItem
            value="tutorial help tour onboarding"
            onSelect={() => runAction(() => window.dispatchEvent(new CustomEvent('open_tutorial')))}
          >
            <LifeBuoy className="mr-2 h-4 w-4" />
            <span>Open tutorial</span>
          </CommandItem>
          <CommandItem
            value="search community gallery browse"
            onSelect={() => goTo('Gallery')}
          >
            <Search className="mr-2 h-4 w-4" />
            <span>Browse community gallery</span>
          </CommandItem>
          <CommandItem
            value="sign out log out logout"
            onSelect={() => runAction(() => supabase.auth.signOut())}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign out</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Navigation, grouped by section */}
        {Object.entries(sections).map(([section, items]) => (
          <CommandGroup key={section} heading={section}>
            {items.map((item) => {
              const Icon = item.icon;
              const searchable = [item.label, ...(item.keywords || [])].join(' ');
              return (
                <CommandItem
                  key={item.page}
                  value={searchable}
                  onSelect={() => goTo(item.page)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                  <CommandShortcut>↵</CommandShortcut>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
