import { useEffect, useRef, useState } from 'react';
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
  Shield,
  AlertOctagon,
  BookOpen,
  LineChart,
  Package,
  ListChecks,
  Scale,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import PageHeader from '@/components/shared/PageHeader';

import AdminOverview from '@/components/admin/AdminOverview';
import AnalyticsDashboard from '@/components/admin/AnalyticsDashboard';
import ProductAnalytics from '@/components/admin/ProductAnalytics';
import StoreAdmin from '@/components/admin/StoreAdmin';
import AdminTasks from '@/components/admin/AdminTasks';
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
import BlogManager from '@/components/admin/blog/BlogManager';
import TestimonialsAdmin from '@/components/admin/TestimonialsAdmin';
import AIFeedbackQueue from '@/components/morph-id/AIFeedbackQueue';

/**
 * Admin Panel, sidebar layout grouped by responsibility.
 *
 * Sections:
 *   Overview           , KPIs + recent activity + quick links
 *   Users              , search, role/expert grants, message
 *   Moderation         , delete forum posts, comments, listings
 *   Morph Guides       , full CRUD on the morph_guides table
 *   Pages              , toggle visibility / page settings
 *   Morph Submissions  , review user-submitted reference photos
 *   Morph ID review    , corrections and "send for expert review" requests
 *                        from Morph ID results (same queue as /Training)
 *   Scraped Data       , review training-data candidates
 *   Analytics          , charts + cohort breakdowns
 *   Messaging          , broadcast messages to users
 *   Changelog          , publish app changelog entries
 *   System             , env / supabase / build health checks
 *
 * Each section is self-contained, picking one renders just that component
 * in the main pane, so loading the panel never fans out queries across
 * every tab.
 */

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'tasks', label: 'Tasks', icon: ListChecks },
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
      { id: 'blog', label: 'Blog', icon: BookOpen },
      { id: 'pages', label: 'Pages', icon: Layout },
      { id: 'morph_id_review', label: 'Morph ID review', icon: Scale },
      { id: 'morph_submissions', label: 'Morph submissions', icon: CheckSquare },
      { id: 'testimonials', label: 'Testimonials', icon: Megaphone },
    ],
  },
  {
    label: 'Insights',
    items: [
      { id: 'product_analytics', label: 'Product analytics', icon: LineChart },
      { id: 'analytics', label: 'Marketplace analytics', icon: BarChart2 },
    ],
  },
  {
    label: 'Marketplace',
    items: [
      { id: 'store', label: 'Store', icon: Package },
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
  tasks: 'Admin tasks',
  users: 'User management',
  support: 'Support inbox',
  moderation: 'Content moderation',
  messaging: 'Mass messaging',
  changelog: 'Changelog',
  morph_guides: 'Morph guide editor',
  blog: 'Blog',
  pages: 'Page management',
  morph_id_review: 'Morph ID review queue',
  morph_submissions: 'Morph submissions',
  testimonials: 'Landing-page testimonials',
  product_analytics: 'Product analytics',
  analytics: 'Marketplace analytics',
  store: 'Store',
  scraped_data: 'Scraped data review',
  errors: 'Error logs',
  system: 'System health',
};

export default function AdminPanel() {
  const { user, isLoadingAuth } = useAuth();
  // ?section=morph_id_review (or any section id) opens that section directly.
  const [section, setSection] = useState(() => {
    try {
      const wanted = new URLSearchParams(window.location.search).get('section');
      return wanted && SECTION_TITLES[wanted] ? wanted : 'overview';
    } catch {
      return 'overview';
    }
  });
  // Prefill payload passed into MassMessaging when the Changelog manager
  // clicks "Broadcast". Consumed on mount by the target component.
  const [messagingPrefill, setMessagingPrefill] = useState(null);
  // Refs for the scrollable panes, the panel keeps the document fixed
  // and scrolls each pane internally so the page never jumps when the
  // section content height changes.
  const mainRef = useRef(null);
  const sidebarRef = useRef(null);
  // Unverified Morph ID samples waiting for an expert, shown as a badge.
  const [reviewCount, setReviewCount] = useState(null);

  useEffect(() => {
    const onPrefill = (e) => {
      if (!e.detail) return;
      setMessagingPrefill(e.detail);
      setSection('messaging');
    };
    window.addEventListener('admin:prefill-message', onPrefill);
    return () => window.removeEventListener('admin:prefill-message', onPrefill);
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin') return undefined;
    let cancelled = false;
    supabase
      .from('gecko_images')
      .select('id', { count: 'exact', head: true })
      .eq('verified', false)
      .then(({ count }) => { if (!cancelled) setReviewCount(count ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.role, section]);

  // Gate: only admins may access this page.
  // Placed after all hooks to satisfy React's rules-of-hooks.
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 md:p-8">
        <div className="max-w-[1600px] mx-auto py-20 flex justify-center">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
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
      case 'tasks':
        return <AdminTasks />;
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
      case 'blog':
        return <BlogManager />;
      case 'pages':
        return <PageManagement />;
      case 'morph_id_review':
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-400 max-w-3xl">
              Corrections and &quot;Send for expert review&quot; requests from Morph ID results land here, along with
              photos contributed on the Training page. Approving one makes it verified reference data. Experts who
              are not admins review the same queue at /Training, on the Review queue tab.
            </p>
            <AIFeedbackQueue />
          </div>
        );
      case 'morph_submissions':
        return <MorphSubmissionReview />;
      case 'testimonials':
        return <TestimonialsAdmin />;
      case 'product_analytics':
        return <ProductAnalytics />;
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'store':
        return <StoreAdmin />;
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

  // Fixed-viewport layout from lg up. The document itself doesn't scroll;
  // both the sidebar and the main pane scroll internally. Switching
  // sections no longer changes the page scroll position because the page
  // itself is locked at viewport height, only the inner pane's scrollbar
  // moves. Below lg the panes stack, so the page scrolls normally
  // (locking it there gave the whole height to the nav and hid the
  // section content on phones).
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 lg:h-full lg:flex lg:flex-col lg:overflow-hidden">
      <div className="max-w-[1600px] w-full mx-auto lg:flex lg:flex-1 lg:flex-col lg:min-h-0">
        <PageHeader
          icon={Shield}
          title="Admin Panel"
          description="Geck Inspect control center"
        />
        <div className="flex flex-col lg:flex-row gap-6 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
          {/* Sidebar, internal scroll for projects with long admin nav. */}
          <aside
            ref={sidebarRef}
            className="lg:w-64 shrink-0 lg:overflow-y-auto custom-scrollbar lg:pr-1"
          >
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
                            className={`touch:min-h-11 w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                              isActive
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                            }`}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="flex-1 text-left">{item.label}</span>
                            {item.id === 'morph_id_review' && reviewCount > 0 && (
                              <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-1.5 text-[10px] font-semibold text-amber-300">
                                {reviewCount}
                              </span>
                            )}
                            {isActive && <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          {/* Main pane. From lg up it scrolls internally so the document
              never moves when section content height changes. */}
          <main
            ref={mainRef}
            className="flex-1 min-w-0 lg:overflow-y-auto custom-scrollbar lg:pr-1"
          >
            <header className="mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-slate-100">
                {SECTION_TITLES[section] || 'Admin'}
              </h2>
              <div className="h-px bg-slate-800 mt-4" />
            </header>
            {/* min-h-full keeps the inner content at least as tall as the
                pane so switching from a long section to a short one
                doesn't bounce the inner scrollbar back to top. */}
            <div className="min-h-full pb-12">
              {renderSection()}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
