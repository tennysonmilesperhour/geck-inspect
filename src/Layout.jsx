import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import "@/styles/layout-theme.css";
import { initialsAvatarUrl } from "@/components/shared/InitialsAvatar";
import { createPageUrl, getDisplayName } from "@/utils";
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { APP_LOGO_URL } from '@/lib/constants';
import {
  Database, Users, LogOut, Search, Settings, UserPlus, Shield, Mail, Menu, Star, GraduationCap, ChevronDown, Pin, PinOff
} from "lucide-react";
import TutorialModal from "@/components/tutorial/TutorialModal";
import CommandPalette from "@/components/command-palette/CommandPalette";
import FeedingAlertSystem from "@/components/feeding/FeedingAlertSystem";
import HatchAlertSystem from "@/components/breeding/HatchAlertSystem";
import NotificationPopover from "@/components/notifications/NotificationPopover";
import PushEnableBanner from "@/components/notifications/PushEnableBanner";
import GuestMockDisclaimer from "@/components/auth/GuestMockDisclaimer";
import FeedbackWidget from "@/components/feedback/FeedbackWidget";
import MarketIntelligenceButton from "@/components/shared/MarketIntelligenceButton";
import InstallAppButton from "@/components/shared/InstallAppButton";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent as SidebarBody,
  SidebarFooter,
  SidebarProvider,
  useSidebar
} from "@/components/ui/Sidebar";
import { Button } from "@/components/ui/button";
import UserBadge from "@/components/ui/UserBadge";
import TierBadge, { tierRingClass } from "@/components/ui/TierBadge";
import ReferralLinkCard from "@/components/shared/ReferralLinkCard";


// Non-React concerns extracted from this file as part of the hairball
// cleanup ,  pure JS cache + rate-limit helpers, and the static
// navigation / level-progression constants.
import { dataCache, retryApiCall } from '@/lib/layoutCache';
import {
  MILESTONES,
  USER_LEVELS,
  EXPERT_LEVELS,
  COMMUNITY_LEVELS,
} from '@/lib/layoutConstants';
import {
  FALLBACK_NAV_ITEMS,
  NAV_ICON_MAP,
  FAVORITES_MAX,
  flattenNavItems,
  SECTIONS,
  getSectionForPage,
} from '@/lib/navItems';


function LayoutContent({ children, currentPageName: _currentPageName }) {
  const location = useLocation();
  const { user, logout, isGuest } = useAuth();
  const sidebarRef = useRef(null);
  const [imageCount, setImageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMilestone, setCurrentMilestone] = useState(null);
  const [userLevel, setUserLevel] = useState(null);
  const [imageLevel, setImageLevel] = useState(null);
  const [communityLevel, setCommunityLevel] = useState(null);
  const [_pinnedPosts, setPinnedPosts] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [appLogo, setAppLogo] = useState(null);
  const [pageConfigs, setPageConfigs] = useState([]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isSidebarLocked, setIsSidebarLocked] = useState(() => {
    try { return localStorage.getItem('sidebar_locked') === '1'; }
    catch { return false; }
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(!isSidebarLocked);
  const collapseTimerRef = useRef(null);

  const expandSidebar = () => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    setIsSidebarCollapsed(false);
  };

  const scheduleCollapseSidebar = () => {
    if (isSidebarLocked) return;
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => setIsSidebarCollapsed(true), 140);
  };

  const toggleSidebarLock = () => {
    setIsSidebarLocked(prev => {
      const next = !prev;
      try { localStorage.setItem('sidebar_locked', next ? '1' : '0'); } catch {}
      if (next) {
        if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
        setIsSidebarCollapsed(false);
      }
      return next;
    });
  };

  useEffect(() => () => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
  }, []);

  // Active section drives the top/bottom section bars + sidebar filter.
  // If the URL points to a page in a section, that section wins. On
  // section-agnostic pages (Dashboard, MyProfile, Settings) we fall back
  // to the last section the user was in, so the sidebar doesn't go
  // empty when they hit home. DB overrides (page_config.section) are
  // applied once page configs finish loading ,  see the effect below.
  const currentPageName = location.pathname.replace(/^\/+/, '').split('/')[0] || '';

  // DB-backed per-page section override. `page_config.section` wins over
  // the hardcoded map when set ,  lets admins move pages between sections
  // without a code deploy.
  const dbSectionByPage = useMemo(() => {
    const map = new Map();
    for (const p of pageConfigs || []) {
      if (p?.page_name && p?.section) map.set(p.page_name, p.section);
    }
    return map;
  }, [pageConfigs]);
  const resolveSection = (pageName) =>
    dbSectionByPage.get(pageName) || getSectionForPage(pageName);

  const [activeSectionId, setActiveSectionId] = useState(() => {
    const s = getSectionForPage(currentPageName);
    if (s) return s;
    try { return localStorage.getItem('active_section') || SECTIONS[0].id; }
    catch { return SECTIONS[0].id; }
  });

  // Update the active section whenever the URL or DB overrides change.
  useEffect(() => {
    const resolved = resolveSection(currentPageName);
    if (resolved && resolved !== activeSectionId) {
      setActiveSectionId(resolved);
      try { localStorage.setItem('active_section', resolved); } catch {}
    }
  }, [currentPageName, dbSectionByPage, activeSectionId]);

  const { toggleSidebar } = useSidebar();

  useEffect(() => {
    const handler = () => setShowTutorial(true);
    window.addEventListener('open_tutorial', handler);
    return () => window.removeEventListener('open_tutorial', handler);
  }, []);

  // Auto-open the tutorial on the first authenticated session, once per
  // browser. A small delay avoids colliding with the initial page load.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('geck_inspect_tutorial_seen') === '1') return;
    const timer = setTimeout(() => {
      setShowTutorial(true);
      localStorage.setItem('geck_inspect_tutorial_seen', '1');
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const getUserLevel = (geckoCount) => {
    return [...USER_LEVELS].reverse().find((level) => geckoCount >= level.geckos) || USER_LEVELS[0];
  };

  const _getNextLevel = (geckoCount) => {
    return USER_LEVELS.find((level) => geckoCount < level.geckos);
  };

  const getImageLevel = (imageCount) => {
    return [...EXPERT_LEVELS].reverse().find((level) => imageCount >= level.points) || EXPERT_LEVELS[0];
  };

  const getCommunityLevel = (postCount) => {
    return [...COMMUNITY_LEVELS].reverse().find((level) => postCount >= level.points) || COMMUNITY_LEVELS[0];
  };

  useEffect(() => {
    setAppLogo(APP_LOGO_URL);
  }, []);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const handleScroll = () => {
      sessionStorage.setItem('sidebarScrollPos', sidebar.scrollTop.toString());
    };

    const scrollPos = sessionStorage.getItem('sidebarScrollPos');
    if (scrollPos) {
      setTimeout(() => {
        if (sidebarRef.current) {
          sidebarRef.current.scrollTop = parseInt(scrollPos, 10);
        }
      }, 50);
    }

    sidebar.addEventListener('scroll', handleScroll);
    return () => {
      if (sidebar) {
        sidebar.removeEventListener('scroll', handleScroll);
      }
    };
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Notification polling - always fetch fresh on mount, every 60 seconds,
  // AND on any `unread_counts_changed` window event (so marking something
  // read on another page updates the header badge immediately).
  useEffect(() => {
  let errorCount = 0;
  const MAX_ERRORS = 3;

  if (user && user.email) {
    const fetchUnread = async (forceRefresh = false) => {
      try {
        const cacheKey = `notifications_${user.email}`;

        if (forceRefresh) {
          dataCache.clear(cacheKey);
        }

        if (!forceRefresh) {
          const cached = dataCache.get(cacheKey);
          if (cached) {
            const filteredCached = cached.filter(
              n => !dismissedNotificationIds.current.has(n.id)
            );
            setUnreadNotificationsCount(filteredCached.length);
            setRecentNotifications(filteredCached);
            return;
          }
        }

        if (errorCount < MAX_ERRORS) {
          dataCache.markRequestMade(cacheKey);
          const unreadNotifications = await retryApiCall(() => 
            base44.entities.Notification.filter({ user_email: user.email, is_read: false })
          );
          if (unreadNotifications) {
            // Filter out any notifications the user dismissed this session
            const filtered = unreadNotifications.filter(
              n => !dismissedNotificationIds.current.has(n.id)
            );
            dataCache.set(cacheKey, filtered);
            setUnreadNotificationsCount(filtered.length);
            setRecentNotifications(filtered);
            errorCount = 0;
          }
        }
      } catch (e) {
        errorCount++;
        if (e.message?.includes('replica set') || e.message?.includes('Timeout') || e.response?.status === 500) {
          console.log(`Database temporarily unavailable (attempt ${errorCount}/${MAX_ERRORS}). Using cached data.`);
        } else if (e.response?.status !== 429) {
          setUnreadNotificationsCount(0);
        }
      }
    };

    fetchUnread(true); // Always fresh on mount
    const interval = setInterval(() => fetchUnread(false), 60 * 1000);
    const onChange = (e) => {
      if (!e?.detail?.kind || e.detail.kind === 'notifications') {
        fetchUnread(true);
      }
    };
    window.addEventListener('unread_counts_changed', onChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener('unread_counts_changed', onChange);
    };
  } else {
    setUnreadNotificationsCount(0);
  }
  }, [user]);
  
  // Unread message polling + event-driven refresh. Previously polled
  // every 30 minutes with a cache that never invalidated ,  which is why
  // the badge didn't clear after reading a conversation. Now:
  //   * Polls every 60s
  //   * Invalidates the cache on force-refresh
  //   * Listens for `unread_counts_changed` so selectConversation()
  //     updates the header badge immediately without a reload.
  useEffect(() => {
    let errorCount = 0;
    const MAX_ERRORS = 3;

    if (user && user.email) {
      const cacheKey = `unread_messages_count_${user.email}`;
      const fetchUnreadMessages = async (forceRefresh = false) => {
        try {
          if (forceRefresh) {
            dataCache.clear(cacheKey);
          }
          const cachedCount = dataCache.get(cacheKey);
          if (!forceRefresh && cachedCount !== null && cachedCount !== undefined) {
            setUnreadMessages(cachedCount);
            errorCount = 0;
            return;
          }
          if (dataCache.canMakeRequest(cacheKey) && errorCount < MAX_ERRORS) {
            dataCache.markRequestMade(cacheKey);
            const unread = await retryApiCall(() =>
              base44.entities.DirectMessage.filter({ recipient_email: user.email, is_read: false })
            );
            setUnreadMessages(unread.length);
            dataCache.set(cacheKey, unread.length);
            errorCount = 0;
          }
        } catch (e) {
          errorCount++;
          if (e.message?.includes('replica set') || e.message?.includes('Timeout') || e.response?.status === 500) {
            const cached = dataCache.get(cacheKey);
            if (cached !== null && cached !== undefined) setUnreadMessages(cached);
          } else if (e.response?.status !== 429) {
            setUnreadMessages(0);
          }
        }
      };

      fetchUnreadMessages(true);
      const interval = setInterval(() => fetchUnreadMessages(false), 60 * 1000);
      const onChange = (e) => {
        if (!e?.detail?.kind || e.detail.kind === 'messages') {
          fetchUnreadMessages(true);
        }
      };
      window.addEventListener('unread_counts_changed', onChange);
      return () => {
        clearInterval(interval);
        window.removeEventListener('unread_counts_changed', onChange);
      };
    } else {
      setUnreadMessages(0);
    }
  }, [user]);

  // Sidebar data: contributions, levels, images, page configs.
  // User comes from useAuth() ,  no separate fetch needed.
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Load page configs
        let configs = dataCache.get('page_configs');
        if (!configs && dataCache.canMakeRequest('page_configs')) {
          try {
            dataCache.markRequestMade('page_configs');
            configs = await retryApiCall(() => base44.entities.PageConfig.list());
            if (Array.isArray(configs)) {
              dataCache.set('page_configs', configs);
              setPageConfigs(configs);
            }
          } catch (error) {
            console.log("Could not load page configs:", error);
            setPageConfigs([]);
          }
        } else if (Array.isArray(configs)) {
          setPageConfigs(configs);
        }

        // Load user-specific data with very heavy caching
        if (user) {
          let userContributions = dataCache.get(`user_contributions_${user.email}`);
          if (!userContributions && dataCache.canMakeRequest(`user_contributions_${user.email}`)) {
            try {
              dataCache.markRequestMade(`user_contributions_${user.email}`);

              const results = await Promise.allSettled([
                retryApiCall(() => base44.entities.Gecko.filter({ created_by: user.email })),
                retryApiCall(() => base44.entities.GeckoImage.filter({ created_by: user.email })),
                retryApiCall(() => base44.entities.ForumPost.filter({ created_by: user.email }))
              ]);

              userContributions = {
                geckoCount: results[0].status === 'fulfilled' ? results[0].value.length : 0,
                imageCount: results[1].status === 'fulfilled' ? results[1].value.length : 0,
                postCount: results[2].status === 'fulfilled' ? results[2].value.length : 0
              };
              dataCache.set(`user_contributions_${user.email}`, userContributions);
            } catch (error) {
              console.log("Could not load user contributions (rate limited):", error);
              userContributions = { geckoCount: 0, imageCount: 0, postCount: 0 };
            }
          }

          if (userContributions) {
            const level = getUserLevel(userContributions.geckoCount);
            setUserLevel({ ...level, geckoCount: userContributions.geckoCount });

            const imageLevelData = getImageLevel(userContributions.imageCount);
            setImageLevel({ ...imageLevelData, imageCount: userContributions.imageCount });

            const communityLevelData = getCommunityLevel(userContributions.postCount);
            setCommunityLevel({ ...communityLevelData, contributionCount: userContributions.postCount });
          }
        }

        // Load public data with very heavy caching
        let images = dataCache.get('gecko_images');
        if (!images && dataCache.canMakeRequest('gecko_images')) {
          try {
            dataCache.markRequestMade('gecko_images');
            images = await retryApiCall(() => base44.entities.GeckoImage.list());
            if (images) {
              dataCache.set('gecko_images', images);
            }
          } catch (error) {
            console.log("Could not load images (rate limited):", error);
            images = dataCache.get('gecko_images') || [];
          }
        }

        if (images && images.length > 0) {
          setImageCount(images.length);
          const milestone = [...MILESTONES].reverse().find((m) => images.length >= m.count);
          setCurrentMilestone(milestone);
        } else {
          setImageCount(0);
        }

        // Skip pinned posts to reduce API calls
        setPinnedPosts([]);

      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Live sidebar updates when an admin toggles a page in PageManagement.
  // PageManagement clears `page_configs` in dataCache and fires
  // `page_configs_changed` after every successful write; we re-fetch
  // the list here so the sidebar reflects the new state without a
  // browser reload.
  useEffect(() => {
    const refresh = async () => {
      try {
        const configs = await retryApiCall(() => base44.entities.PageConfig.list());
        if (Array.isArray(configs)) {
          dataCache.set('page_configs', configs);
          setPageConfigs(configs);
        }
      } catch (error) {
        console.log('Could not refresh page configs after change:', error);
      }
    };
    window.addEventListener('page_configs_changed', refresh);
    return () => window.removeEventListener('page_configs_changed', refresh);
  }, []);


  const handleLogin = () => {
    window.location.href = '/AuthPortal';
  };

  const handleLogout = async () => {
    try {
      dataCache.clearAll();
      setUserLevel(null);
      setImageLevel(null);
      setCommunityLevel(null);
      setUnreadNotificationsCount(0);
      setUnreadMessages(0);
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // IDs of notifications the user dismissed this session ,  prevents
  // them from reappearing in the popover even if the server re-fetch
  // race condition returns them before the DB write propagates.
  // Persist dismissed notification IDs in sessionStorage so they
  // survive page navigations / redirects within the same session.
  const dismissedNotificationIds = useRef(() => {
    try {
      const stored = sessionStorage.getItem('geck_dismissed_notifs');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  // Lazy-init the ref (useRef doesn't call functions)
  if (typeof dismissedNotificationIds.current === 'function') {
    dismissedNotificationIds.current = dismissedNotificationIds.current();
  }

  const handleMarkNotificationRead = async (notificationId) => {
    // Immediately remove from local state and track as dismissed
    dismissedNotificationIds.current.add(notificationId);
    try {
      sessionStorage.setItem('geck_dismissed_notifs', JSON.stringify([...dismissedNotificationIds.current]));
    } catch {}
    setRecentNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    setUnreadNotificationsCount((c) => Math.max(0, c - 1));
    try {
      await base44.entities.Notification.update(notificationId, { is_read: true });
      // Clear cache so the next poll gets fresh data (after DB write)
      const cacheKey = `notifications_${user?.email}`;
      dataCache.clear(cacheKey);
    } catch (e) {
      console.warn('Failed to mark notification read:', e);
    }
    window.dispatchEvent(new CustomEvent('unread_counts_changed', { detail: { kind: 'notifications' } }));
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!user?.email) return;
    const unread = recentNotifications.filter((n) => !n.is_read);
    if (unread.length === 0) return;
    // Optimistically clear local state and remember dismissals
    unread.forEach((n) => dismissedNotificationIds.current.add(n.id));
    try {
      sessionStorage.setItem('geck_dismissed_notifs', JSON.stringify([...dismissedNotificationIds.current]));
    } catch {}
    setRecentNotifications([]);
    setUnreadNotificationsCount(0);
    try {
      // Mark every unread notification for this user, not just the recent slice
      const all = await base44.entities.Notification.filter(
        { user_email: user.email, is_read: false }
      );
      await Promise.all(
        all.map((n) => base44.entities.Notification.update(n.id, { is_read: true }))
      );
      const cacheKey = `notifications_${user.email}`;
      dataCache.clear(cacheKey);
    } catch (e) {
      console.warn('Failed to mark all notifications read:', e);
    }
    window.dispatchEvent(new CustomEvent('unread_counts_changed', { detail: { kind: 'notifications' } }));
  };

  const handleLoginPrompt = (featureName) => {
    if (window.confirm(`${featureName} requires an account. Would you like to sign up or log in now?`)) {
      handleLogin();
    }
  };

  const nextMilestone = MILESTONES.find((m) => imageCount < m.count);
  const goalCount = nextMilestone ? nextMilestone.count : 100000;
  const _progressPercent = Math.min(100, imageCount / goalCount * 100);

  const getSidebarBadge = () => {
    if (!user) return null;

    const pref = user.sidebar_badge_preference || 'collection';

    if (pref === 'collection' && userLevel) {
      return {
        badge: userLevel.badge,
        title: userLevel.title,
        count: userLevel.geckoCount,
        label: "geckos"
      };
    }
    if (pref === 'ai_training' && imageLevel) {
      return {
        badge: imageLevel.badge,
        title: imageLevel.title,
        count: imageLevel.imageCount,
        label: 'images'
      }
    }
    if (pref === 'community' && communityLevel) {
      return {
        badge: communityLevel.badge,
        title: communityLevel.title,
        count: communityLevel.contributionCount,
        label: 'contributions'
      }
    }
    if (userLevel) {
      return {
        badge: userLevel.badge,
        title: userLevel.title,
        count: userLevel.geckoCount,
        label: "geckos"
      };
    }

    return null;
  }

  const sidebarBadge = getSidebarBadge();

  // Build navigation from PageConfig.
  //
  // The DB is the source of truth for ordering and visibility. Fallback
  // items are ONLY used to populate the sidebar when a brand-new page
  // hasn't been seeded into page_config yet. If page_config explicitly
  // marks a page as disabled (is_enabled=false), it stays hidden ,  even
  // for admins. The previous version re-merged fallback items back in,
  // which is why disabled pages still appeared in the admin sidebar.
  const getNavItems = () => {
    if (!Array.isArray(pageConfigs) || pageConfigs.length === 0) {
      return FALLBACK_NAV_ITEMS;
    }

    // Dedupe page_config rows by page_name. Admins can end up with
    // multiple rows sharing the same page_name (historical seeding bug);
    // without this collapse the sidebar would render each copy as its
    // own item. Preference: enabled row, then most recently updated.
    const byName = new Map();
    for (const p of pageConfigs) {
      if (!p?.page_name) continue;
      const prev = byName.get(p.page_name);
      if (!prev) {
        byName.set(p.page_name, p);
        continue;
      }
      const prevEnabled = prev.is_enabled !== false;
      const pEnabled = p.is_enabled !== false;
      if (pEnabled && !prevEnabled) {
        byName.set(p.page_name, p);
      } else if (pEnabled === prevEnabled) {
        const prevDate = new Date(prev.updated_date || prev.created_date || 0).getTime();
        const pDate = new Date(p.updated_date || p.created_date || 0).getTime();
        if (pDate > prevDate) byName.set(p.page_name, p);
      }
    }
    const dedupedConfigs = Array.from(byName.values());

    // Index DB rows by page_name so we can detect what's NOT seeded yet.
    const dbByName = {};
    for (const p of dedupedConfigs) {
      if (p?.page_name) dbByName[p.page_name] = p;
    }

    // Index fallback items by page_name so we can preserve the
    // canonical display_name / icon across renames.
    const fallbackByName = {};
    for (const category of ['collection', 'tools', 'public']) {
      for (const f of (FALLBACK_NAV_ITEMS[category] || [])) {
        fallbackByName[f.page_name] = { ...f, _category: category };
      }
    }

    // Start with the DB rows that are explicitly enabled.
    const enabled = dedupedConfigs
      .filter(p => p.is_enabled !== false)
      .sort((a, b) => (a.order_position ?? 0) - (b.order_position ?? 0));

    const dbNav = {
      collection: enabled.filter(p => p.category === 'collection'),
      tools: enabled.filter(p => p.category === 'tools'),
      public: enabled.filter(p => p.category === 'public'),
    };

    // Update display_name / icon from the fallback (canonical labels).
    for (const category of ['collection', 'tools', 'public']) {
      dbNav[category] = dbNav[category].map(p => {
        const fb = fallbackByName[p.page_name];
        if (fb && (fb.display_name !== p.display_name || fb.icon !== p.icon)) {
          return { ...p, display_name: fb.display_name, icon: fb.icon };
        }
        return p;
      });
    }

    // Seed: if a fallback item has NEVER been written to page_config
    // (brand-new page that an admin hasn't touched yet), surface it so
    // the sidebar isn't missing entries on a first deploy. Fallbacks
    // are NOT used to override an existing DB row ,  meaning a disabled
    // page stays disabled.
    for (const category of ['collection', 'tools', 'public']) {
      for (const fallback of (FALLBACK_NAV_ITEMS[category] || [])) {
        if (!dbByName[fallback.page_name]) {
          dbNav[category].push(fallback);
        }
      }
    }

    return dbNav;
  };

  const rawNavItems = getNavItems();

  // Favorite pages ,  user picks up to FAVORITES_MAX pages in Settings.
  // Those get a prominent 2x2 grid at the top of the sidebar and are
  // hidden from their original category section so they don't appear
  // twice. Stored on auth.user_metadata + profiles.favorite_page_names.
  const favoritePageNames = Array.isArray(user?.favorite_page_names)
    ? user.favorite_page_names.slice(0, FAVORITES_MAX)
    : [];
  const favoriteSet = new Set(favoritePageNames);

  // Resolve favorite page_names to actual nav items so we have
  // display_name + icon. Preserve user's chosen order.
  const allNavFlat = flattenNavItems(rawNavItems);
  const favoriteItems = favoritePageNames
    .map((name) => allNavFlat.find((item) => item.page_name === name))
    .filter(Boolean);

  // Strip favorites from the normal sections so they aren't rendered
  // twice.
  const navItems = {
    collection: rawNavItems.collection.filter((i) => !favoriteSet.has(i.page_name)),
    tools: rawNavItems.tools.filter((i) => !favoriteSet.has(i.page_name)),
    public: rawNavItems.public.filter((i) => !favoriteSet.has(i.page_name)),
  };

  // Sidebar filtered to the active section. We flatten across the old
  // category buckets (collection/tools/public) because sections are now
  // the primary grouping ,  a single page can live anywhere in the DB
  // category and still show up under its section.
  const activeSection = SECTIONS.find((s) => s.id === activeSectionId) || SECTIONS[0];
  const sectionNavItems = flattenNavItems(navItems)
    .filter((item) => resolveSection(item.page_name) === activeSectionId);

  const renderFavoritesGrid = () => {
    if (favoriteItems.length === 0) return null;
    return (
      <div className="px-3 mb-4">
        <div className="text-xs font-semibold text-sage-700 uppercase tracking-wider px-1 pb-2 sidebar-collapse-hide">
          Favorites
        </div>
        <div className="grid grid-cols-2 gap-2">
          {favoriteItems.map((item) => {
            const itemUrl = createPageUrl(item.page_name);
            const isActive = location.pathname === itemUrl;
            const IconComponent = NAV_ICON_MAP[item.icon] || Database;
            const handleNavClick = (e) => {
              if (item.requires_auth && !user) {
                e.preventDefault();
                handleLoginPrompt(item.display_name);
                if (window.innerWidth < 768) toggleSidebar(false);
              }
            };
            return (
              <Link
                key={item.page_name}
                to={itemUrl}
                onClick={handleNavClick}
                data-tutorial-id={item.page_name}
                data-tutorial-label={item.display_name}
                className={`group flex flex-col items-center justify-center gap-2 rounded-lg border px-2 py-4 text-center transition-colors sidebar-nav-item favorite-tile ${
                  isActive
                    ? 'active border-emerald-500/60 bg-emerald-600/25 text-emerald-50'
                    : 'border-emerald-800/40 bg-emerald-900/25 text-emerald-100 hover:bg-emerald-800/40 hover:border-emerald-700/60'
                }`}
              >
                <IconComponent className="h-7 w-7 flex-shrink-0" />
                <span className="text-[11px] font-semibold leading-tight line-clamp-2 sidebar-collapse-hide">
                  {item.display_name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  // Modified renderNavSection to handle auth requirements
  const renderNavSection = (items, title) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="mb-1">
        {title && <div className="text-xs font-semibold text-sage-700 uppercase tracking-wider px-4 py-2">{title}</div>}
        <nav className="space-y-1 px-2">
          {items.map((item) => {
            const itemUrl = createPageUrl(item.page_name);
            const isActive = location.pathname === itemUrl;
            
            const handleNavClick = (e) => {
              if (item.requires_auth && !user) {
                e.preventDefault();
                handleLoginPrompt(item.display_name);
                if (window.innerWidth < 768) {
                    toggleSidebar(false);
                }
                return;
              }
            };

            const IconComponent = NAV_ICON_MAP[item.icon] || Database;
            
            return (
              <Link
                key={item.page_name}
                to={itemUrl}
                onClick={handleNavClick}
                data-tutorial-id={item.page_name}
                data-tutorial-label={item.display_name}
                className={`group flex items-center rounded-md px-2 py-2 text-xs font-medium transition-colors duration-200 sidebar-nav-item
                  ${isActive
                    ? "active"
                    : "text-gray-300 hover:bg-gray-700 hover:text-foreground"
                  }`}
              >
                <IconComponent className="mr-2 h-5 w-5 flex-shrink-0" />
                <span className="truncate">{item.display_name}</span>
                {/* Guests keep `user` set (GUEST_USER) so the "Login"
                    marker below doesn't trigger; instead we flag pages
                    gated behind auth as view-only so the visitor knows
                    upfront which tabs they can actually use.           */}
                {isGuest && item.requires_auth && (
                  <span
                    className="ml-auto shrink-0 text-[9px] font-bold uppercase tracking-wider text-yellow-200 bg-yellow-400/15 border border-yellow-300/30 rounded px-1.5 py-0.5"
                    title="Guests can view this page but cannot save changes"
                  >
                    view only
                  </span>
                )}
                {item.requires_auth && !user && (
                  <span className="ml-auto text-xs text-sage-500">Login</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    );
  };

  return (
    <>
      {/* Skip-to-content link for keyboard/screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100000] focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none"
      >
        Skip to content
      </a>
      <div className="flex h-screen bg-background font-sans app-container-outline">
        {/* Mobile Sidebar */}
        <Sidebar className="mobile-sidebar-glass border-r border-emerald-800/40 bg-emerald-950/25 backdrop-blur-sm md:hidden z-50">
          <SidebarHeader className="border-b border-emerald-800/40 px-6 pb-6 pt-[calc(1.5rem+env(safe-area-inset-top))]">
          <Link to={createPageUrl("Dashboard")} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-700/40 hover:bg-emerald-800/30 transition-colors duration-200">
          {appLogo && (
            <img 
              src={appLogo}
              alt="Geck Inspect Logo" 
              className="h-8 w-8 object-contain rounded-lg"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://i.imgur.com/gfaW2Yg.png';
              }}
            />
          )}
              <span className="text-lg font-bold text-emerald-100" style={{fontFamily: "'Righteous', cursive", letterSpacing: '0.03em'}}>Geck Inspect</span>
            </Link>
          </SidebarHeader>

          <SidebarBody ref={sidebarRef} className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="px-4 pt-2 pb-3 md:hidden">
              <InstallAppButton />
            </div>
            <div className="px-4 mb-4">
              {user ? (
                <div className={`flex items-center gap-3 ${tierRingClass(user)}`}>
                  <Link to={createPageUrl('MyProfile')}>
                      <img
                            src={user.profile_image_url || initialsAvatarUrl(getDisplayName(user))}
                            alt="User avatar"
                            className="w-8 h-8 rounded-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                    </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={createPageUrl('MyProfile')} className="font-medium text-emerald-100 text-sm truncate">{getDisplayName(user)}</Link>
                      <TierBadge user={user} size="xs" />
                    </div>
                    <p className="text-xs text-emerald-300/80 truncate">{user.email}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button
                    onClick={handleLogin}
                    className="w-full bg-gradient-to-r from-sage-600 to-earth-600 hover:from-sage-700 hover:to-earth-700 shadow-lg text-sm">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Sign Up / Login
                  </Button>
                  <div className="text-xs text-emerald-300/70 text-center">
                    Create an account to save your work and manage your gecko collection
                  </div>
                </div>
              )}
            </div>

            {renderFavoritesGrid()}
            {renderNavSection(sectionNavItems, activeSection.label)}
            {user?.role === 'admin' && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-sage-700 uppercase tracking-wider px-4 py-2">Admin</div>
                <nav className="space-y-1 px-2">
                  <Link
                    to={createPageUrl("AdminPanel")}
                    className={`group flex items-center rounded-md px-2 py-2 text-xs font-medium transition-colors duration-200 sidebar-nav-item ${
                      location.pathname === createPageUrl("AdminPanel")
                        ? "active"
                        : "text-gray-300 hover:bg-gray-700 hover:text-foreground"
                    }`}
                  >
                    <Shield className="mr-2 h-5 w-5 flex-shrink-0" />
                    Admin Panel
                  </Link>
                </nav>
              </div>
            )}
          </SidebarBody>

          {/* Scroll hint ,  a fade + bouncing chevron that overlaps the
              end of the scrollable nav so users see, at a glance,
              that there's more content above the footer. Pulled up
              with negative margin so the gradient visually blends
              into the last visible nav item. */}
          <div
            aria-hidden="true"
            className="sidebar-scroll-hint pointer-events-none relative -mt-10 h-10 flex items-end justify-center bg-gradient-to-t from-emerald-950/70 via-emerald-950/25 to-transparent"
          >
            <ChevronDown className="w-4 h-4 text-emerald-300/80 animate-bounce mb-1" />
          </div>

          <SidebarFooter className="px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-emerald-900/40">
            <div className="space-y-3">
              <Link to="/PrivacyPolicy" className="block text-xs text-slate-500 hover:text-slate-300 px-3 transition-colors">Privacy Policy</Link>
              <ReferralLinkCard />
              <Link to={createPageUrl("Membership")} className="block">
                <Button variant="outline" size="sm" className="w-full justify-start text-emerald-100/80 hover:text-white border-emerald-900/60 hover:border-emerald-700/60 text-sm">
                  <Star className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">Membership</span>
                </Button>
              </Link>
              <div className="block">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTutorial(true)}
                  className="w-full justify-start text-emerald-100/80 hover:text-white border-emerald-900/60 hover:border-emerald-700/60 text-sm"
                >
                  <GraduationCap className="w-4 h-4 mr-2 flex-shrink-0" />
                  App Tutorial
                </Button>
              </div>

              {user ?
                <div className="space-y-3">
                  {sidebarBadge && (
                    <UserBadge
                      badge={sidebarBadge.badge}
                      title={sidebarBadge.title}
                      count={sidebarBadge.count}
                      label={sidebarBadge.label}
                    />
                  )}

                  <Link to={createPageUrl("Settings")} className="block">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-emerald-100/80 hover:text-white border-emerald-900/60 hover:border-emerald-700/60 text-sm">
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Button>
                  </Link>

                  <div className="text-xs text-emerald-200/50 px-3">
                    Logged in as {getDisplayName(user)}
                    {user.is_expert && <span className="ml-2 text-green-600">✓ Expert</span>}
                    {user.role === 'admin' && <span className="ml-2 text-purple-600">⚡ Admin</span>}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="w-full justify-start text-emerald-100/80 hover:text-white border-emerald-900/60 hover:border-emerald-700/60 text-sm">
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </div> :
                null}
            </div>
          </SidebarFooter>
        </Sidebar>


        {/* Edge hover detector ,  expands the collapsed rail before the
            cursor physically reaches it, giving a smoother feel. Only
            mounted while collapsed so it can't intercept clicks on the
            expanded sidebar's left edge. */}
        {isSidebarCollapsed && (
          <div
            aria-hidden="true"
            className="hidden md:block fixed top-0 left-0 h-full w-3 z-40"
            onMouseEnter={expandSidebar}
          />
        )}
        {/* Desktop sidebar ,  fixed, so the expanded panel overlays the
            page instead of reflowing it. Main content gets enough
            left-padding at md breakpoint to clear the collapsed rail. */}
        <div
          className={`hidden md:flex fixed top-0 left-0 h-full z-40 desktop-sidebar-wrapper ${isSidebarCollapsed ? 'is-collapsed' : ''}`}
          onMouseEnter={expandSidebar}
          onMouseLeave={scheduleCollapseSidebar}
        >
          <div className="flex flex-col h-full desktop-sidebar-inner mobile-sidebar-glass bg-emerald-950/25 backdrop-blur-sm border-r border-emerald-800/40">
            <div className="flex flex-grow flex-col overflow-y-auto overflow-x-hidden custom-scrollbar pt-5" ref={sidebarRef}>
              <div className="flex items-center flex-shrink-0 px-3 mb-4 desktop-sidebar-logo">
                <Link to={createPageUrl("Dashboard")} className="flex items-center gap-3 w-full px-3 py-3 rounded-xl border border-emerald-700/40 bg-emerald-900/20 hover:bg-emerald-800/40 transition-colors duration-200">
                  {appLogo && (
                    <img
                      src={appLogo}
                      alt="Geck Inspect Logo"
                      className="h-10 w-10 object-contain rounded-lg flex-shrink-0"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = APP_LOGO_URL;
                      }}
                    />
                  )}
                  <span className="text-xl font-bold text-emerald-100 sidebar-collapse-hide whitespace-nowrap" style={{fontFamily: "'Righteous', cursive", letterSpacing: '0.03em'}}>Geck Inspect</span>
                </Link>
              </div>

              <div className="px-4 mb-4">
                {user ? (
                  <div className={`flex items-center gap-3 ${tierRingClass(user)}`}>
                    <Link to={createPageUrl('MyProfile')}>
                          <img
                            src={user.profile_image_url || initialsAvatarUrl(getDisplayName(user))}
                            alt="User avatar"
                            className="w-8 h-8 rounded-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        </Link>
                    <div className="flex-1 min-w-0 sidebar-collapse-hide">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={createPageUrl('MyProfile')} className="font-medium text-emerald-100 text-sm truncate">{getDisplayName(user)}</Link>
                        <TierBadge user={user} size="xs" />
                      </div>
                      <p className="text-xs text-emerald-300/80 truncate">{user.email}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 sidebar-collapse-hide">
                    <Button
                      onClick={handleLogin}
                      className="w-full bg-gradient-to-r from-sage-600 to-earth-600 hover:from-sage-700 hover:to-earth-700 shadow-lg text-sm">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Sign Up / Login
                    </Button>
                    <div className="text-xs text-emerald-300/70 text-center">
                      Create an account to save your work and manage your gecko collection
                    </div>
                  </div>
                )}
              </div>

              {renderFavoritesGrid()}
              {renderNavSection(sectionNavItems, activeSection.label)}
              {user?.role === 'admin' && (
                <div className="mb-4">
                  <div className="text-xs font-semibold text-sage-700 uppercase tracking-wider px-4 py-2">Admin</div>
                  <nav className="space-y-1 px-2">
                    <Link
                      to={createPageUrl("AdminPanel")}
                      className={`group flex items-center rounded-md px-2 py-2 text-xs font-medium transition-colors duration-200 sidebar-nav-item ${
                        location.pathname === createPageUrl("AdminPanel")
                          ? "active"
                          : "text-gray-300 hover:bg-gray-700 hover:text-foreground"
                      }`}
                    >
                      <Shield className="mr-2 h-5 w-5 flex-shrink-0" />
                      <span>Admin Panel</span>
                    </Link>
                  </nav>
                </div>
              )}

              <div className="p-4 border-t border-emerald-900/40 mt-auto">
                <div className="space-y-3">
                  <Link to="/PrivacyPolicy" className="block text-xs text-slate-500 hover:text-slate-300 px-3 transition-colors sidebar-collapse-hide">Privacy Policy</Link>
                  <ReferralLinkCard />
                  <Link to={createPageUrl("Membership")} className="block">
                    <Button variant="outline" size="sm" className="w-full justify-start text-emerald-100/80 hover:text-white border-emerald-900/60 hover:border-emerald-700/60 text-sm">
                      <Star className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="truncate sidebar-collapse-hide">Membership</span>
                    </Button>
                  </Link>
                  <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTutorial(true)}
                    className="w-full justify-start text-emerald-100/80 hover:text-white border-emerald-900/60 hover:border-emerald-700/60 text-sm"
                  >
                    <GraduationCap className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="sidebar-collapse-hide">App Tutorial</span>
                  </Button>
                  </div>

                  {user ?
                    <div className="space-y-3">
                      {sidebarBadge && (
                        <div className="sidebar-collapse-hide">
                          <UserBadge
                            badge={sidebarBadge.badge}
                            title={sidebarBadge.title}
                            count={sidebarBadge.count}
                            label={sidebarBadge.label}
                          />
                        </div>
                      )}

                      <Link to={createPageUrl("Settings")} className="block">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-emerald-100/80 hover:text-white border-emerald-900/60 hover:border-emerald-700/60 text-sm">
                          <Settings className="w-4 h-4 mr-2" />
                          <span className="sidebar-collapse-hide">Settings</span>
                        </Button>
                      </Link>

                      <div className="text-xs text-emerald-200/50 px-3 sidebar-collapse-hide">
                        Logged in as {getDisplayName(user)}
                        {user.is_expert && <span className="ml-2 text-green-600">✓ Expert</span>}
                        {user.role === 'admin' && <span className="ml-2 text-purple-600">⚡ Admin</span>}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLogout}
                        className="w-full justify-start text-emerald-100/80 hover:text-white border-emerald-900/60 hover:border-emerald-700/60 text-sm">
                        <LogOut className="w-4 h-4 mr-2" />
                        <span className="sidebar-collapse-hide">Logout</span>
                      </Button>
                    </div> :
                    null}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSidebarLock}
                    title={isSidebarLocked ? "Unlock ,  sidebar will auto-collapse on mouse leave" : "Lock sidebar open"}
                    aria-label={isSidebarLocked ? "Unlock sidebar" : "Lock sidebar open"}
                    className="w-full justify-start text-emerald-100/70 hover:text-white hover:bg-emerald-800/30 text-xs sidebar-lock-toggle"
                  >
                    {isSidebarLocked
                      ? <PinOff className="w-4 h-4 mr-2 text-emerald-300" />
                      : <Pin className="w-4 h-4 mr-2" />}
                    <span className="sidebar-collapse-hide">{isSidebarLocked ? "Unlock sidebar" : "Lock sidebar open"}</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <main id="main-content" className={`flex-1 flex flex-col min-w-0 transition-[padding] duration-200 ease-out ${isSidebarLocked ? 'md:pl-[13.6rem]' : 'md:pl-[3.4rem]'}`}>
          <header className="bg-sage-200/90 backdrop-blur-md border-b border-sage-300 px-[max(0.75rem,env(safe-area-inset-left))] pb-1.5 pt-[calc(0.375rem+env(safe-area-inset-top))] md:hidden sticky top-0 z-10 gecko-header gecko-header--compact">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={toggleSidebar}
                className="hover:bg-emerald-500/20 rounded-lg transition-colors duration-200 inline-flex items-center justify-center w-9 h-9 text-emerald-200 hover:text-emerald-50"
                aria-label="Toggle Sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                {user ? (
                  <div className="gecko-header-actions">
                    <MarketIntelligenceButton user={user} />
                    <Link to={createPageUrl("Messages")} className="gecko-header-action" aria-label="Messages">
                      <Mail />
                      {unreadMessages > 0 && (
                        <span className="notification-badge">
                          {unreadMessages > 99 ? '99+' : unreadMessages}
                        </span>
                      )}
                    </Link>
                    <NotificationPopover
                      notifications={recentNotifications}
                      unreadCount={unreadNotificationsCount}
                      onMarkRead={handleMarkNotificationRead}
                      onMarkAllRead={handleMarkAllNotificationsRead}
                    />
                    <Link to={createPageUrl("MyProfile")} className="gecko-header-action" aria-label="Profile">
                      <Users />
                    </Link>
                  </div>
                ) : (
                  <Button onClick={handleLogin} size="sm" className="bg-gradient-to-r from-sage-600 to-earth-600 hover:from-sage-700 hover:to-earth-700">
                    <UserPlus className="w-4 h-4 mr-1" />
                    Login
                  </Button>
                )}
              </div>
            </div>
          </header>

          <header className="bg-sage-200/90 backdrop-blur-md border-b border-sage-300 px-4 py-3 hidden md:flex sticky top-0 z-10 gecko-header">
            <div className="flex items-center gap-4 w-full">
              {/* Command palette launcher */}
              <div className="flex-1 min-w-0 flex items-center">
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('open_command_palette'))}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-700/40 bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 hover:text-emerald-200 transition-colors text-sm w-72 max-w-full"
                  aria-label="Open quick search"
                >
                  <Search className="w-4 h-4" />
                  <span className="flex-1 text-left text-emerald-500/70">Quick search…</span>
                </button>
              </div>

              {/* Section tabs (desktop) */}
              <nav
                className="flex items-center gap-1 bg-emerald-950/50 border border-emerald-800/50 rounded-xl p-1 shadow-inner"
                aria-label="App sections"
              >
                {SECTIONS.map((section) => {
                  const IconComponent = NAV_ICON_MAP[section.icon] || Database;
                  const isActive = section.id === activeSectionId;
                  return (
                    <Link
                      key={section.id}
                      to={createPageUrl(section.defaultPage)}
                      aria-current={isActive ? 'page' : undefined}
                      data-tutorial-id={`__section_${section.id}`}
                      data-tutorial-label={section.label}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                        isActive
                          ? 'bg-emerald-700/60 text-emerald-50 shadow-sm'
                          : 'text-emerald-200/80 hover:text-emerald-100 hover:bg-emerald-800/40'
                      }`}
                    >
                      <IconComponent className="h-4 w-4" />
                      <span>{section.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="flex-1 flex justify-end items-center gap-2">
                {user ? (
                  <div className="gecko-header-actions">
                    <MarketIntelligenceButton user={user} />
                    <Link to={createPageUrl("Messages")} className="gecko-header-action" aria-label="Messages">
                      <Mail />
                      {unreadMessages > 0 && (
                        <span className="notification-badge">
                          {unreadMessages > 99 ? '99+' : unreadMessages}
                        </span>
                      )}
                    </Link>
                    <NotificationPopover
                      notifications={recentNotifications}
                      unreadCount={unreadNotificationsCount}
                      onMarkRead={handleMarkNotificationRead}
                      onMarkAllRead={handleMarkAllNotificationsRead}
                    />
                    <Link to={createPageUrl("MyProfile")} className="gecko-header-action" aria-label="Profile">
                      <Users />
                    </Link>
                  </div>
                ) : (
                  <Button onClick={handleLogin} size="sm" className="bg-gradient-to-r from-sage-600 to-earth-600 hover:from-sage-700 hover:to-earth-700">
                    <UserPlus className="w-4 h-4 mr-1" />
                    Login
                  </Button>
                )}
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto overflow-x-hidden pb-9 md:pb-0">
            <PushEnableBanner user={user} />
            {children}
          </div>


          </main>

        {/* Section tabs (mobile) ,  fixed bottom bar */}
        <nav
          className="gecko-bottom-nav fixed bottom-0 left-0 right-0 z-40 md:hidden flex"
          aria-label="App sections"
        >
          {SECTIONS.map((section) => {
            const IconComponent = NAV_ICON_MAP[section.icon] || Database;
            const isActive = section.id === activeSectionId;
            return (
              <Link
                key={section.id}
                to={createPageUrl(section.defaultPage)}
                aria-current={isActive ? 'page' : undefined}
                data-tutorial-id={`__section_${section.id}`}
                data-tutorial-label={section.label}
                className={`gecko-bottom-nav__item ${isActive ? 'is-active' : ''}`}
              >
                <IconComponent className="h-5 w-5" />
                <span>{section.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <TutorialModal isOpen={showTutorial} onClose={() => setShowTutorial(false)} />
      <CommandPalette />
      <FeedingAlertSystem
        user={user}
        enabled={user?.feeding_alerts_enabled !== false}
        lateReminders={user?.feeding_late_reminders_enabled === true}
      />
      {/* Always run the hatch producer for signed-in users; per-channel
          (push/email) opt-out lives in Settings → Notifications. The bell
          notification is non-disruptive, so no separate master toggle. */}
      <HatchAlertSystem user={user} enabled={Boolean(user?.email)} />
      <GuestMockDisclaimer />
      {user && <FeedbackWidget />}
    </>
    );
          }

          export default function Layout({ children, currentPageName }) {
          return (
          <SidebarProvider>
          <LayoutContent children={children} currentPageName={currentPageName} />
          </SidebarProvider>
          );
          }