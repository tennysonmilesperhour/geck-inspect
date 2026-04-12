import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Sparkles,
  ShieldAlert,
  Megaphone,
  Bell,
  BarChart2,
  Database,
  Layout,
  CheckSquare,
  Activity,
  ChevronRight,
  LifeBuoy,
} from 'lucide-react';

import AdminOverview from '@/components/admin/AdminOverview';
import AnalyticsDashboard from '@/components/admin/AnalyticsDashboard';
import UserManagement from '@/components/admin/UserManagement';
import MorphGuideEditor from '@/components/admin/MorphGuideEditor';
import ContentModeration from '@/components/admin/ContentModeration';
import MassMessaging from '@/components/admin/MassMessaging';
import ChangeLogManager from '@/components/admin/ChangeLogManager';
import ScrapedDataReview from '@/components/admin/ScrapedDataReview';
import PageManagement from '@/components/admin/PageManagement';
import MorphSubmissionReview from '@/components/admin/MorphSubmissionReview';
import SystemHealth from '@/components/admin/SystemHealth';
import SupportInbox from '@/components/admin/SupportInbox';

/**
 * Admin Panel — sidebar layout grouped by responsibility.
 *
 * Sections:
 *   Overview            — KPIs + recent activity + quick links
 *   Users               — search, role/expert grants, message
 *   Moderation          — delete forum posts, comments, listings
 *   Morph Guides        — full CRUD on the morph_guides table
 *   Pages               — toggle visibility / page settings
 *   Morph Submissions   — review user-submitted reference photos
 *   Scraped Data        — review training-data candidates
 *   Analytics           — charts + cohort breakdowns
 *   Messaging           — broadcast messages to users
 *   Changelog           — publish app changelog entries
 *   System              — env / supabase / build health checks
 *
 * Each section is self-contained — picking one renders just that component
 * in the main pane, so loading the panel never fans out queries across
 * every tab.
 */

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Community',
    items: [
      { id: 'users', label: 'Users', icon: Users },
      { id: 'support', label: 'Support inbox', icon: LifeBuoy },
      { id: 'moderation', label: 'Content moderation', icon: ShieldAlert },
      { id: 'messaging', label: 'Mass messaging', icon: Megaphone },
      { id: 'changelog', label: 'Changelog', icon: Bell },
    ],
  },
  {
    label: 'Content',
    items: [
      { id: 'morph_guides', label: 'Morph guides', icon: Sparkles },
      { id: 'pages', label: 'Pages', icon: Layout },
      { id: 'morph_submissions', label: 'Morph submissions', icon: CheckSquare },
    ],
  },
  {
    label: 'Insights',
    items: [
      { id: 'analytics', label: 'Analytics', icon: BarChart2 },
      { id: 'scraped_data', label: 'Scraped data', icon: Database },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'system', label: 'Health & build', icon: Activity },
    ],
  },
];

const SECTION_TITLES = {
  overview: 'Overview',
  users: 'User management',
  support: 'Support inbox',
  moderation: 'Content moderation',
  messaging: 'Mass messaging',
  changelog: 'Changelog',
  morph_guides: 'Morph guide editor',
  pages: 'Page management',
  morph_submissions: 'Morph submissions',
  analytics: 'Analytics',
  scraped_data: 'Scraped data review',
  system: 'System health',
};

export default function AdminPanel() {
  const { user, isLoadingAuth } = useAuth();
  const [section, setSection] = useState('overview');
  // Prefill payload passed into MassMessaging when the Changelog manager
  // clicks "Broadcast". Consumed on mount by the target component.
  const [messagingPrefill, setMessagingPrefill] = useState(null);

  // Gate: only admins may access this page.
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    const onPrefill = (e) => {
      if (!e.detail) return;
      setMessagingPrefill(e.detail);
      setSection('messaging');
    };
    window.addEventListener('admin:prefill-message', onPrefill);
    return () => window.removeEventListener('admin:prefill-message', onPrefill);
  }, []);

  const renderSection = () => {
    switch (section) {
      case 'overview':
        return <AdminOverview onNavigate={setSection} />;
      case 'users':
        return <UserManagement />;
      case 'support':
        return <SupportInbox />;
      case 'moderation':
        return <ContentModeration />;
      case 'messaging':
        return (
          <MassMessaging
            prefill={messagingPrefill}
            onPrefillConsumed={() => setMessagingPrefill(null)}
          />
        );
      case 'changelog':
        return <ChangeLogManager />;
      case 'morph_guides':
        return <MorphGuideEditor />;
      case 'pages':
        return <PageManagement />;
      case 'morph_submissions':
        return <MorphSubmissionReview />;
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'scraped_data':
        return <ScrapedDataReview />;
      case 'system':
        return <SystemHealth />;
      default:
        return <AdminOverview onNavigate={setSection} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6 p-4 md:p-6">
        {/* Sidebar */}
        <aside className="lg:w-64 shrink-0">
          <div className="lg:sticky lg:top-6 space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Admin</h1>
              <p className="text-xs text-slate-500 mt-0.5">Geck Inspect control center</p>
            </div>
            <nav className="space-y-5">
              {NAV_GROUPS.map((group, idx) => (
                <div key={idx}>
                  {group.label && (
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 px-2">
                      {group.label}
                    </p>
                  )}
                  <ul className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = section === item.id;
                      const Icon = item.icon;
                      return (
                        <li key={item.id}>
                          <button
                            onClick={() => setSection(item.id)}
                            className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                              isActive
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                            }`}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="flex-1 text-left">{item.label}</span>
                            {isActive && <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main pane */}
        <main className="flex-1 min-w-0">
          <header className="mb-6">
            <h2 className="text-3xl font-bold text-white">
              {SECTION_TITLES[section] || 'Admin'}
            </h2>
            <div className="h-px bg-slate-800 mt-4" />
          </header>
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
