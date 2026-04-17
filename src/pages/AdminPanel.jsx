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
  Truck,
  Globe,
  Shield,
  AlertOctagon,
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
import ErrorLogsViewer from '@/components/admin/ErrorLogsViewer';

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
    label: 'Marketplace',
    items: [
      { id: 'analytics', label: 'Analytics', icon: BarChart2 },
      { id: 'shipping', label: 'Shipping config', icon: Truck },
      { id: 'market_data', label: 'Market data', icon: Globe },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'scraped_data', label: 'Scraped data', icon: Database },
      { id: 'errors', label: 'Error logs', icon: AlertOctagon },
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
  shipping: 'Shipping configuration',
  market_data: 'Market data management',
  scraped_data: 'Scraped data review',
  errors: 'Error logs',
  system: 'System health',
};

function AdminPlaceholder({ title, description, icon: Icon }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center space-y-4">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
        <Icon className="w-7 h-7 text-emerald-400" />
      </div>
      <h3 className="text-xl font-bold text-white">{title}</h3>
      <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">{description}</p>
      <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-300">
        Coming soon
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const { user, isLoadingAuth } = useAuth();
  const [section, setSection] = useState('overview');
  // Prefill payload passed into MassMessaging when the Changelog manager
  // clicks "Broadcast". Consumed on mount by the target component.
  const [messagingPrefill, setMessagingPrefill] = useState(null);

  useEffect(() => {
    const onPrefill = (e) => {
      if (!e.detail) return;
      setMessagingPrefill(e.detail);
      setSection('messaging');
    };
    window.addEventListener('admin:prefill-message', onPrefill);
    return () => window.removeEventListener('admin:prefill-message', onPrefill);
  }, []);

  // Gate: only admins may access this page.
  // Placed after all hooks to satisfy React's rules-of-hooks.
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
      case 'shipping':
        return <AdminPlaceholder title="Shipping Configuration" description="Manage the Zero's Geckos shipping integration. Configure API credentials, default carrier settings, and monitor shipment status. This section will be fully functional once the partnership is finalized." icon={Truck} />;
      case 'market_data':
        return <AdminPlaceholder title="Market Data Management" description="Manage data sources for the Market Analytics tab in Business Tools. Configure regional feeds, set data refresh intervals, and review pricing data quality. This section will be activated when real market data pipelines are connected." icon={Globe} />;
      case 'scraped_data':
        return <ScrapedDataReview />;
      case 'errors':
        return <ErrorLogsViewer />;
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
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Admin Panel</h1>
                <p className="text-[10px] text-slate-500 mt-0.5">Geck Inspect control center</p>
              </div>
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
