import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import "@/styles/layout-theme.css";
import { initialsAvatarUrl } from "@/components/shared/InitialsAvatar";
import { createPageUrl } from "@/utils";
import { base44 } from '@/api/base44Client';
import { supabase, normalizeSupabaseUser } from '@/lib/supabaseClient';
import {
  Database, BookOpen, BarChart3, Upload, Users, HeartHandshake, Layers, LogOut, Search, Settings, UserPlus, Shield, MessageSquare, Bell, Mail, Heart, Menu, ShoppingCart, GitBranch, FlaskConical, Star, FolderKanban, GraduationCap, Dna,
  Egg, LayoutGrid, CircleUser, UsersRound, Images, Tag, CalendarDays, Sparkles
} from "lucide-react";
import TutorialModal from "@/components/tutorial/TutorialModal";
import CommandPalette from "@/components/command-palette/CommandPalette";
import FeedingAlertSystem from "@/components/feeding/FeedingAlertSystem";
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


// Non-React concerns extracted from this file as part of the hairball
// cleanup — pure JS cache + rate-limit helpers, and the static
// navigation / level-progression constants.
import { dataCache, retryApiCall } from '@/lib/layoutCache';
import {
  MILESTONES,
  USER_LEVELS,
  EXPERT_LEVELS,
  COMMUNITY_LEVELS,
} from '@/lib/layoutConstants';


function LayoutContent({ children, currentPageName: _currentPageName }) {
  const location = useLocation();
  const sidebarRef = useRef(null);
  const [imageCount, setImageCount] = useState(0);
  const [_isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [_currentMilestone, setCurrentMilestone] = useState(null);
  const [userLevel, setUserLevel] = useState(null);
  const [imageLevel, setImageLevel] = useState(null);
  const [communityLevel, setCommunityLevel] = useState(null);
  const [_pinnedPosts, setPinnedPosts] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [appLogo, setAppLogo] = useState(null);
  const [pageConfigs, setPageConfigs] = useState([]);
  const [showTutorial, setShowTutorial] = useState(false);

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
    const _logoUrl = window.APP_LOGO_URL;
    setAppLogo('https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68929cdad944c572926ab6cb/2ba53d481_Inspect.png');
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
            setUnreadNotificationsCount(cached.length);
            return;
          }
        }

        if (errorCount < MAX_ERRORS) {
          dataCache.markRequestMade(cacheKey);
          const unreadNotifications = await retryApiCall(() => 
            base44.entities.Notification.filter({ user_email: user.email, is_read: false })
          );
          if (unreadNotifications) {
            dataCache.set(cacheKey, unreadNotifications);
            setUnreadNotificationsCount(unreadNotifications.length);
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
  // every 30 minutes with a cache that never invalidated — which is why
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

  // Enhanced authentication check with better error handling
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

        // Try to get user first with heavy caching
        let currentUser = dataCache.get('current_user_v2');
        if (!currentUser && dataCache.canMakeRequest('current_user_v2')) {
          try {
            dataCache.markRequestMade('current_user_v2');
            const { data: { user: _supaUser } } = await supabase.auth.getUser();
            currentUser = normalizeSupabaseUser(_supaUser);
            if (currentUser) {
              // Enrich with the profile row so user.role, bio, business_name,
              // etc. are available for the sidebar admin check and other UI
              // bits. Without this, user.role is undefined even when the
              // profiles row is correctly marked admin in the database.
              try {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('email', currentUser.email)
                  .maybeSingle();
                if (profile) currentUser = { ...currentUser, ...profile };
              } catch (profileErr) {
                console.log('Profile enrichment failed:', profileErr);
              }
              dataCache.set('current_user_v2', currentUser);
              setUser(currentUser);
            }
          } catch (error) {
            console.log("User authentication check failed:", error);
            setUser(null);
            setUserLevel(null);
            setImageLevel(null);
            setCommunityLevel(null);
            setUnreadMessages(0);
            setUnreadNotificationsCount(0);
            dataCache.clear('current_user_v2');
          }
        } else if (currentUser) {
          setUser(currentUser);
        }

        // Load user-specific data with very heavy caching
        if (currentUser) {
          let userContributions = dataCache.get(`user_contributions_${currentUser.email}`);
          if (!userContributions && dataCache.canMakeRequest(`user_contributions_${currentUser.email}`)) {
            try {
              dataCache.markRequestMade(`user_contributions_${currentUser.email}`);

              const results = await Promise.allSettled([
                retryApiCall(() => base44.entities.Gecko.filter({ created_by: currentUser.email })),
                retryApiCall(() => base44.entities.GeckoImage.filter({ created_by: currentUser.email })),
                retryApiCall(() => base44.entities.ForumPost.filter({ created_by: currentUser.email }))
              ]);

              userContributions = {
                geckoCount: results[0].status === 'fulfilled' ? results[0].value.length : 0,
                imageCount: results[1].status === 'fulfilled' ? results[1].value.length : 0,
                postCount: results[2].status === 'fulfilled' ? results[2].value.length : 0
              };
              dataCache.set(`user_contributions_${currentUser.email}`, userContributions);
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
    
    // Removed periodic auth check to reduce API calls
  }, []);


  const handleLogin = () => {
    window.location.href = '/AuthPortal';
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserLevel(null);
      setImageLevel(null);
      setCommunityLevel(null);
      dataCache.clearAll();
      setUnreadNotificationsCount(0);
      setUnreadMessages(0);
      window.location.reload();
    } catch (error) {
      console.error("Logout failed:", error);
    }
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

  const FALLBACK_NAV_ITEMS = {
    collection: [
    { page_name: "MyGeckos", display_name: "My Geckos", icon: "LayoutGrid", category: "collection", requires_auth: true, is_enabled: true, order: 1 },
    { page_name: "Breeding", display_name: "Breeding", icon: "Egg", category: "collection", requires_auth: true, is_enabled: true, order: 2 },
    { page_name: "Lineage", display_name: "Lineage", icon: "GitBranch", category: "collection", requires_auth: true, is_enabled: true, order: 3 },
    { page_name: "MyProfile", display_name: "My Profile", icon: "CircleUser", category: "collection", requires_auth: true, is_enabled: true, order: 4 },
    ],
    tools: [
      { page_name: "Recognition", display_name: "Morph ID", icon: "Search", category: "tools", requires_auth: false, is_enabled: true, order: 1 },
      { page_name: "MorphVisualizer", display_name: "Morph Visualizer", icon: "Layers", category: "tools", requires_auth: false, is_enabled: true, order: 2 },
      { page_name: "BreederConsultant", display_name: "AI Consultant", icon: "FlaskConical", category: "tools", requires_auth: false, is_enabled: true, order: 3 },
      { page_name: "ProjectManager", display_name: "Season Planner", icon: "CalendarDays", category: "tools", requires_auth: true, is_enabled: true, order: 4 },
      { page_name: "GeneticsGuide", display_name: "Genetics Guide", icon: "Dna", category: "tools", requires_auth: false, is_enabled: true, order: 5 },
    ],
    public: [
    { page_name: "Dashboard", display_name: "Dashboard", icon: "BarChart3", category: "public", requires_auth: false, is_enabled: true, order: 1 },
    { page_name: "MorphGuide", display_name: "Morph Guide", icon: "BookOpen", category: "public", requires_auth: false, is_enabled: true, order: 2 },
    { page_name: "CareGuide", display_name: "Care Guide", icon: "Heart", category: "public", requires_auth: false, is_enabled: true, order: 3 },
    { page_name: "Forum", display_name: "Forum", icon: "MessageSquare", category: "public", requires_auth: false, is_enabled: true, order: 4 },
    { page_name: "Gallery", display_name: "Image Gallery", icon: "Images", category: "public", requires_auth: false, is_enabled: true, order: 5 },
    { page_name: "Marketplace", display_name: "Marketplace", icon: "ShoppingCart", category: "public", requires_auth: false, is_enabled: true, order: 6 },
    { page_name: "MarketplaceSalesStats", display_name: "Sales Stats", icon: "BarChart3", category: "public", requires_auth: true, is_enabled: true, order: 7 },
    ],
  };

  // Build navigation from PageConfig
  const getNavItems = () => {
    if (!Array.isArray(pageConfigs) || pageConfigs.length === 0) {
      return FALLBACK_NAV_ITEMS;
    }

    const enabled = pageConfigs
      .filter(p => p.is_enabled)
      .sort((a, b) => (a.order_position ?? 0) - (b.order_position ?? 0));
    
    return {
      collection: enabled.filter(p => p.category === 'collection'),
      tools: enabled.filter(p => p.category === 'tools'),
      public: enabled.filter(p => p.category === 'public')
    };
  };

  const navItems = getNavItems();

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

            const iconMap = {
                                  BarChart3, Search, Layers, FlaskConical, BookOpen, Heart, MessageSquare,
                                  Database, ShoppingCart, Users, GitBranch, Upload, Shield, HeartHandshake, FolderKanban, Dna, GraduationCap, Star, Settings,
                                  Egg, LayoutGrid, CircleUser, UsersRound, Images, Tag, CalendarDays, Sparkles
                                };
                                const IconComponent = iconMap[item.icon] || Database;
            
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
                    : "text-gray-600 dark:text-gray-300 hover:bg-sage-50 dark:hover:bg-gray-700 hover:text-sage-900 dark:hover:text-white"
                  }`}
              >
                <IconComponent className="mr-2 h-5 w-5 flex-shrink-0" />
                {item.display_name}
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
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900 font-sans app-container-outline">
        {/* Mobile Sidebar */}
        <Sidebar className="border-r border-sage-300 bg-sage-200/90 backdrop-blur-sm md:hidden z-50">
          <SidebarHeader className="border-b border-sage-300 p-6">
          <Link to={createPageUrl("Dashboard")} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-sage-300 hover:bg-sage-100 transition-colors duration-200">
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
              <span className="text-lg font-bold text-sage-800" style={{fontFamily: "'Righteous', cursive", letterSpacing: '0.03em'}}>Geck Inspect</span>
            </Link>
          </SidebarHeader>

          <SidebarBody ref={sidebarRef} className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="px-4 mb-4">
              {user ? (
                <div className="flex items-center gap-3">
                  <Link to={createPageUrl('MyProfile')}>
                      <img 
                            src={user.profile_image_url || initialsAvatarUrl(user.full_name)} 
                            alt="User avatar" 
                            className="w-8 h-8 rounded-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                    </Link>
                  <div className="flex-1">
                    <Link to={createPageUrl('MyProfile')} className="font-medium text-sage-800 text-sm">{user.full_name}</Link>
                    <p className="text-xs text-sage-600">{user.email}</p>
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
                  <div className="text-xs text-sage-500 text-center">
                    Create an account to save your work and manage your gecko collection
                  </div>
                </div>
              )}
            </div>
            
            {renderNavSection(navItems.collection, "Collection")}
            {renderNavSection(navItems.tools, "Tools")}
            {renderNavSection(navItems.public)}
            {user?.role === 'admin' && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-sage-700 uppercase tracking-wider px-4 py-2">Admin</div>
                <nav className="space-y-1 px-2">
                  <Link
                    to={createPageUrl("AdminPanel")}
                    className={`group flex items-center rounded-md px-2 py-2 text-xs font-medium transition-colors duration-200 sidebar-nav-item ${
                      location.pathname === createPageUrl("AdminPanel")
                        ? "active"
                        : "text-gray-600 dark:text-gray-300 hover:bg-sage-50 dark:hover:bg-gray-700 hover:text-sage-900 dark:hover:text-white"
                    }`}
                  >
                    <Shield className="mr-2 h-5 w-5 flex-shrink-0" />
                    Admin Panel
                  </Link>
                </nav>
              </div>
            )}
          </SidebarBody>

          <SidebarFooter className="p-4 border-t border-sage-300">
            <div className="space-y-3">
              <Link to="/PrivacyPolicy" className="block text-xs text-slate-500 hover:text-slate-300 px-3 transition-colors">Privacy Policy</Link>
              <Link to={createPageUrl("Membership")} className="block">
                <Button variant="outline" size="sm" className="w-full justify-start text-sage-600 hover:text-sage-700 border-sage-300 text-sm">
                  <Star className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">Membership</span>
                </Button>
              </Link>
              <div className="block">
                <button
                 onClick={() => setShowTutorial(true)}
                 className="w-full group flex items-center justify-start rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 border border-sage-300 text-sage-600 hover:bg-sage-50 dark:text-sage-400 dark:border-sage-600 dark:hover:bg-sage-900/20"
                >
                 <GraduationCap className="w-4 h-4 mr-2 flex-shrink-0" />
                 App Tutorial
                </button>
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
                      className="w-full justify-start text-sage-600 hover:text-sage-700 border-sage-300 text-sm">
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Button>
                  </Link>

                  <div className="text-xs text-sage-500 px-3">
                    Logged in as {user.full_name}
                    {user.is_expert && <span className="ml-2 text-green-600">✓ Expert</span>}
                    {user.role === 'admin' && <span className="ml-2 text-purple-600">⚡ Admin</span>}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="w-full justify-start text-sage-600 hover:text-sage-700 border-sage-300 text-sm">
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </div> :
                null}
            </div>
          </SidebarFooter>
        </Sidebar>


        {/* Static sidebar for desktop */}
        <div className="hidden lg:flex lg:flex-shrink-0">
          <div className="flex w-64 flex-col">
            <div className="flex flex-grow flex-col overflow-y-auto bg-white dark:bg-gray-800 pt-5 border-r border-gray-200 dark:border-gray-700" ref={sidebarRef}>
              <div className="flex items-center flex-shrink-0 px-6 mb-4">
                <Link to={createPageUrl("Dashboard")} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-sage-300 dark:border-emerald-700/50 hover:bg-sage-100 dark:hover:bg-emerald-900/30 transition-colors duration-200">
                  {appLogo && (
                    <img
                      src={appLogo}
                      alt="Geck Inspect Logo"
                      className="h-8 w-8 object-contain rounded-lg"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68929cdad944c572926ab6cb/2ba53d481_Inspect.png';
                      }}
                    />
                  )}
                  <span className="text-lg font-bold text-sage-800 dark:text-sage-700" style={{fontFamily: "'Righteous', cursive", letterSpacing: '0.03em'}}>Geck Inspect</span>
                </Link>
              </div>

              <div className="px-4 mb-4">
                {user ? (
                  <div className="flex items-center gap-3">
                    <Link to={createPageUrl('MyProfile')}>
                          <img
                            src={user.profile_image_url || initialsAvatarUrl(user.full_name)}
                            alt="User avatar"
                            className="w-8 h-8 rounded-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        </Link>
                    <div className="flex-1">
                      <Link to={createPageUrl('MyProfile')} className="font-medium text-sage-800 dark:text-sage-700 text-sm">{user.full_name}</Link>
                      <p className="text-xs text-sage-600 dark:text-sage-500">{user.email}</p>
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
                    <div className="text-xs text-sage-500 dark:text-sage-400 text-center">
                      Create an account to save your work and manage your gecko collection
                    </div>
                  </div>
                )}
              </div>

              {renderNavSection(navItems.collection, "Collection")}
              {renderNavSection(navItems.tools, "Tools")}
              {renderNavSection(navItems.public)}
              {user?.role === 'admin' && (
                <div className="mb-4">
                  <div className="text-xs font-semibold text-sage-700 uppercase tracking-wider px-4 py-2">Admin</div>
                  <nav className="space-y-1 px-2">
                    <Link
                      to={createPageUrl("AdminPanel")}
                      className={`group flex items-center rounded-md px-2 py-2 text-xs font-medium transition-colors duration-200 sidebar-nav-item ${
                        location.pathname === createPageUrl("AdminPanel")
                          ? "active"
                          : "text-gray-600 dark:text-gray-300 hover:bg-sage-50 dark:hover:bg-gray-700 hover:text-sage-900 dark:hover:text-white"
                      }`}
                    >
                      <Shield className="mr-2 h-5 w-5 flex-shrink-0" />
                      Admin Panel
                    </Link>
                  </nav>
                </div>
              )}
              
              <div className="p-4 border-t border-sage-300 dark:border-sage-300 mt-auto">
                <div className="space-y-3">
                  <Link to="/PrivacyPolicy" className="block text-xs text-slate-500 hover:text-slate-300 px-3 transition-colors">Privacy Policy</Link>
                  <Link to={createPageUrl("Membership")} className="block">
                    <Button variant="outline" size="sm" className="w-full justify-start text-sage-600 hover:text-sage-700 border-sage-300 text-sm">
                      <Star className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="truncate">Membership</span>
                    </Button>
                  </Link>
                  <div>
                  <button
                   onClick={() => setShowTutorial(true)}
                   className="w-full group flex items-center justify-start rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 border border-sage-300 text-sage-600 hover:bg-sage-50 dark:text-sage-400 dark:border-sage-600 dark:hover:bg-sage-900/20"
                  >
                   <GraduationCap className="w-4 h-4 mr-2 flex-shrink-0" />
                   App Tutorial
                  </button>
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
                          className="w-full justify-start text-sage-600 hover:text-sage-700 border-sage-300 text-sm">
                          <Settings className="w-4 h-4 mr-2" />
                          Settings
                        </Button>
                      </Link>

                      <div className="text-xs text-sage-500 dark:text-sage-400 px-3">
                        Logged in as {user.full_name}
                        {user.is_expert && <span className="ml-2 text-green-600">✓ Expert</span>}
                        {user.role === 'admin' && <span className="ml-2 text-purple-600">⚡ Admin</span>}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLogout}
                        className="w-full justify-start text-sage-600 hover:text-sage-700 border-sage-300 text-sm">
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                      </Button>
                    </div> :
                    null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <main className="flex-1 flex flex-col min-w-0">
          <header className="bg-sage-200/90 backdrop-blur-md border-b border-sage-300 px-4 py-3 md:hidden sticky top-0 z-10 gecko-header">
            <div className="flex items-center justify-between gap-4">
              <button onClick={toggleSidebar} className="hover:bg-sage-200 p-2 rounded-lg transition-colors duration-200" aria-label="Toggle Sidebar">
                <Menu className="w-5 h-5 text-sage-600" />
              </button>

              <div className="flex items-center gap-2">
                {user ? (
                  <div className="gecko-header-actions">
                    <Link to={createPageUrl("Messages")} className="gecko-header-action" aria-label="Messages">
                      <Mail />
                      {unreadMessages > 0 && (
                        <span className="notification-badge">
                          {unreadMessages > 99 ? '99+' : unreadMessages}
                        </span>
                      )}
                    </Link>
                    <Link to={createPageUrl("Notifications")} className="gecko-header-action" aria-label="Notifications">
                      <Bell />
                      {unreadNotificationsCount > 0 && (
                        <span className="notification-badge">
                          {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                        </span>
                      )}
                    </Link>
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
            <div className="flex items-center justify-between gap-4 w-full">
              {/* Command palette launcher */}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open_command_palette'))}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-sage-300 bg-white/50 hover:bg-white text-sage-600 hover:text-sage-800 transition-colors text-sm w-72 max-w-full"
                aria-label="Open quick search"
              >
                <Search className="w-4 h-4" />
                <span className="flex-1 text-left text-sage-500">Quick search…</span>
              </button>

              <div className="flex items-center gap-2">
                {user ? (
                  <div className="gecko-header-actions">
                    <Link to={createPageUrl("Messages")} className="gecko-header-action" aria-label="Messages">
                      <Mail />
                      {unreadMessages > 0 && (
                        <span className="notification-badge">
                          {unreadMessages > 99 ? '99+' : unreadMessages}
                        </span>
                      )}
                    </Link>
                    <Link to={createPageUrl("Notifications")} className="gecko-header-action" aria-label="Notifications">
                      <Bell />
                      {unreadNotificationsCount > 0 && (
                        <span className="notification-badge">
                          {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                        </span>
                      )}
                    </Link>
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

          <div className="flex-1 overflow-auto overflow-x-hidden">
            {children}
          </div>


          </main>
      </div>
      <TutorialModal isOpen={showTutorial} onClose={() => setShowTutorial(false)} />
      <CommandPalette />
      <FeedingAlertSystem user={user} enabled={user?.feeding_alerts_enabled !== false} />
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