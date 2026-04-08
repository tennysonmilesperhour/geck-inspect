import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from '@/api/base44Client';
import { GeckoImage } from "@/entities/GeckoImage";
import { User } from "@/entities/User";
import { Gecko } from "@/entities/Gecko";
import { ForumPost } from "@/entities/ForumPost";
import { Notification } from "@/entities/Notification";
import { DirectMessage } from "@/entities/DirectMessage";
import { MorphReferenceImage } from "@/entities/MorphReferenceImage";
import { PageConfig } from "@/entities/PageConfig";
import { useToast } from "@/components/ui/use-toast";
import {
  Database, BookOpen, BarChart3, Upload, Eye, Users, HeartHandshake, Moon, Sun, Layers, LogOut, ExternalLink, Search, Settings, UserPlus, Award, Shield, MessageSquare, Wrench, Bell, Mail, Heart, Brain, Menu, ShoppingCart, GitBranch,
  LogIn, ChevronDown, X as CloseIcon, FlaskConical, LifeBuoy, LayoutDashboard, Star, Trophy, FolderKanban, GraduationCap, Dna,
  Egg, LayoutGrid, CircleUser, UsersRound, Images, Tag, CalendarDays
} from "lucide-react";
import TutorialModal from "../components/tutorial/TutorialModal";
import {
  Sidebar,
  SidebarHeader,
  SidebarBody,
  SidebarFooter,
  SidebarProvider,
  useSidebar
} from "@/components/ui/Sidebar";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import NotificationDropdown from "../components/ui/NotificationDropdown";
import UserBadge from '../components/ui/UserBadge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Much more aggressive cache with longer durations
class DataCache {
  constructor() {
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    this.requestTimestamps = new Map();
    this.CACHE_DURATION = 5 * 60 * 60 * 1000; // Increased to 5 hours
    this.MIN_REQUEST_INTERVAL = 120000; // Minimum 2 minutes between same requests
  }

  isCacheValid(key) {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return false;
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  canMakeRequest(key) {
    const lastRequest = this.requestTimestamps.get(key);
    if (!lastRequest) return true;
    return Date.now() - lastRequest > this.MIN_REQUEST_INTERVAL;
  }

  markRequestMade(key) {
    this.requestTimestamps.set(key, Date.now());
  }

  get(key) {
    if (this.isCacheValid(key)) {
      return this.cache.get(key);
    }
    return null;
  }

  set(key, data) {
    this.cache.set(key, data);
    this.cacheTimestamps.set(key, Date.now());
  }

  clear(key) {
    this.cache.delete(key);
    this.cacheTimestamps.delete(key);
    this.requestTimestamps.delete(key);
  }

  clearAll() {
    this.cache.clear();
    this.cacheTimestamps.clear();
    this.requestTimestamps.clear();
  }
}

// Global cache instance
const dataCache = new DataCache();
window.dataCache = dataCache;

// Utility functions with much longer delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Enhanced retry with exponential backoff
const retryApiCall = async (apiCall, maxRetries = 2, initialDelayMs = 10000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      if (error.response?.status === 429 && attempt < maxRetries) {
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`Rate limit hit, waiting ${delayMs}ms before retry (attempt ${attempt}/${maxRetries})`);
        await delay(delayMs);
        continue;
      }
      throw error;
    }
  }
};

// Much longer debounce
const debouncedApiCall = (() => {
  const debounceMap = new Map();
  
  return (key, apiCall, delayMs = 5000) => { // Increased to 5 seconds
    return new Promise((resolve, reject) => {
      if (debounceMap.has(key)) {
        clearTimeout(debounceMap.get(key));
      }
      
      const timeoutId = setTimeout(async () => {
        try {
          const result = await apiCall();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          debounceMap.delete(key);
        }
      }, delayMs);
      
      debounceMap.set(key, timeoutId);
    });
  };
})();

window.delay = delay;
window.retryApiCall = retryApiCall;

// Navigation items - now always visible
const publicNavItems = [
  { title: "Dashboard", url: createPageUrl("Dashboard"), icon: BarChart3 },
  { title: "Morph ID", url: createPageUrl("Recognition"), icon: Search },
  { title: "Morph Visualizer", url: createPageUrl("MorphVisualizer"), icon: Layers },
  { title: "AI Consultant", url: createPageUrl("BreederConsultant"), icon: FlaskConical },
  { title: "Morph Guide", url: createPageUrl("MorphGuide"), icon: BookOpen },
  { title: "Care Guide", url: createPageUrl("CareGuide"), icon: Heart },
  { title: "Forum", url: createPageUrl("Forum"), icon: MessageSquare },
  { title: "Image Gallery", url: createPageUrl("Gallery"), icon: Database },
  { title: "Marketplace", url: createPageUrl("Marketplace"), icon: ShoppingCart }
];

const userSpecificNavItems = [
  { title: "My Geckos", url: createPageUrl("MyGeckos"), icon: Users, requiresAuth: true },
  { title: "Breeding", url: createPageUrl("Breeding"), icon: GitBranch, requiresAuth: true },
  { title: "Lineage", url: createPageUrl("Lineage"), icon: GitBranch, requiresAuth: true },
  { title: "Sales Stats", url: createPageUrl("MarketplaceSalesStats"), icon: BarChart3, requiresAuth: true },
  { title: "My Profile", url: createPageUrl("MyProfile"), icon: Users, requiresAuth: true },
  { title: "Train Model", url: createPageUrl("Training"), icon: Upload, requiresAuth: true },
];

const adminOnlyNavItems = [
  { title: "Admin Panel", url: createPageUrl("AdminPanel"), icon: Shield }
];

// Milestone and level constants
const MILESTONES = [
  { count: 1000, title: "Community Contributor", description: "First major milestone reached!" },
  { count: 5000, title: "Expert Trainer", description: "Advanced AI training achieved!" },
  { count: 10000, title: "Master Classifier", description: "Professional-grade dataset!" },
  { count: 100000, title: "AI Pioneer", description: "Revolutionary training dataset!" }
];

const USER_LEVELS = [
  { geckos: 1, title: "New Collector", badge: "🥚" },
  { geckos: 2, title: "Gecko Keeper", badge: "🦎" },
  { geckos: 5, title: "Hobbyist", badge: "🌿" },
  { geckos: 10, title: "Enthusiast", badge: "⭐" },
  { geckos: 15, title: "Dedicated Keeper", badge: "🌱" },
  { geckos: 20, title: "Breeder", badge: "❤️‍🔥" },
  { geckos: 30, title: "Pro Breeder", badge: "🏆" },
  { geckos: 40, title: "Expert Breeder", badge: "🧬" },
  { geckos: 50, title: "Master Breeder", badge: "👑" },
  { geckos: 75, title: "Grandmaster", badge: "🌌" },
  { geckos: 100, title: "Living Legend", badge: "💫" },
  { geckos: 150, title: "Gecko Tycoon", badge: "💼" },
  { geckos: 200, title: "Scale Sovereign", badge: "🏰" },
  { geckos: 300, title: "Reptile Royalty", badge: "⚜️" },
  { geckos: 500, title: "Crested King", badge: "🦁" },
];

const EXPERT_LEVELS = [
  { level: 1, title: "Apprentice Trainer", points: 10, badge: "🌱" },
  { level: 2, title: "Skilled Recognizer", points: 50, badge: "🧠" },
  { level: 3, title: "Master Annotator", points: 100, badge: "✍️" },
  { level: 4, title: "AI Virtuoso", points: 250, badge: "🤖" },
  { level: 5, title: "Gecko AI Grandmaster", points: 500, badge: "🌟" }
];

const COMMUNITY_LEVELS = [
  { level: 1, title: "New Contributor", points: 1, badge: "📝" },
  { level: 2, title: "Active Talker", points: 5, badge: "🗣️" },
  { level: 3, title: "Forum Regular", points: 10, badge: "💬" },
  { level: 4, title: "Community Pillar", points: 25, badge: "🏛️" },
  { level: 5, title: "Gecko Guru", points: 50, badge: "🎓" },
];

function LayoutContent({ children, currentPageName }) {
  const location = useLocation();
  const sidebarRef = useRef(null);
  const [imageCount, setImageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [currentMilestone, setCurrentMilestone] = useState(null);
  const [userLevel, setUserLevel] = useState(null);
  const [imageLevel, setImageLevel] = useState(null);
  const [communityLevel, setCommunityLevel] = useState(null);
  const [pinnedPosts, setPinnedPosts] = useState([]);
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

  const getUserLevel = (geckoCount) => {
    return [...USER_LEVELS].reverse().find((level) => geckoCount >= level.geckos) || USER_LEVELS[0];
  };

  const getNextLevel = (geckoCount) => {
    return USER_LEVELS.find((level) => geckoCount < level.geckos);
  };

  const getImageLevel = (imageCount) => {
    return [...EXPERT_LEVELS].reverse().find((level) => imageCount >= level.points) || EXPERT_LEVELS[0];
  };

  const getCommunityLevel = (postCount) => {
    return [...COMMUNITY_LEVELS].reverse().find((level) => postCount >= level.points) || COMMUNITY_LEVELS[0];
  };

  useEffect(() => {
    const logoUrl = window.APP_LOGO_URL;
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

  // Notification polling - always fetch fresh on mount, then every 60 seconds
  useEffect(() => {
  let errorCount = 0;
  const MAX_ERRORS = 3;

  if (user && user.email) {
    const fetchUnread = async (forceRefresh = false) => {
      try {
        const cacheKey = `notifications_${user.email}`;

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
    return () => clearInterval(interval);
  } else {
    setUnreadNotificationsCount(0);
  }
  }, [user]);
  
  // Aggressive message polling with circuit breaker
  useEffect(() => {
    let errorCount = 0;
    const MAX_ERRORS = 3;

    if (user && user.email) {
      const fetchUnreadMessages = async () => {
        try {
          const cacheKey = `unread_messages_count_${user.email}`;
          let cachedCount = dataCache.get(cacheKey);

          if (cachedCount !== null) {
            setUnreadMessages(cachedCount);
            errorCount = 0; // Reset error count on cache hit
          } else if (dataCache.canMakeRequest(cacheKey) && errorCount < MAX_ERRORS) {
            dataCache.markRequestMade(cacheKey);
            const unread = await retryApiCall(() =>
              base44.entities.DirectMessage.filter({ recipient_email: user.email, is_read: false })
            );
            setUnreadMessages(unread.length);
            dataCache.set(cacheKey, unread.length);
            errorCount = 0; // Reset on success
          }
        } catch (e) {
          errorCount++;
          // Silently handle database connectivity errors
          if (e.message?.includes('replica set') || e.message?.includes('Timeout') || e.response?.status === 500) {
            console.log(`Database temporarily unavailable (attempt ${errorCount}/${MAX_ERRORS}). Using cached data.`);
            // Keep existing cached value if available
            const cachedCount = dataCache.get(`unread_messages_count_${user.email}`);
            if (cachedCount !== null && cachedCount !== undefined) {
              setUnreadMessages(cachedCount);
            }
          } else if (e.response?.status !== 429) {
            setUnreadMessages(0);
          }
        }
      };

      fetchUnreadMessages();
      const interval = setInterval(fetchUnreadMessages, 30 * 60 * 1000); // Every 30 minutes
      return () => clearInterval(interval);
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
            if (configs) {
              dataCache.set('page_configs', configs);
              setPageConfigs(configs);
            }
          } catch (error) {
            console.log("Could not load page configs:", error);
            setPageConfigs([]);
          }
        } else if (configs) {
          setPageConfigs(configs);
        }

        // Try to get user first with heavy caching
        let currentUser = dataCache.get('current_user');
        if (!currentUser && dataCache.canMakeRequest('current_user')) {
          try {
            dataCache.markRequestMade('current_user');
            currentUser = await retryApiCall(() => base44.auth.me());
            if (currentUser) {
              dataCache.set('current_user', currentUser);
              setUser(currentUser);
              console.log('User authenticated successfully:', currentUser.email);
            }
          } catch (error) {
            console.log("User authentication check failed:", error);
            setUser(null);
            setUserLevel(null);
            setImageLevel(null);
            setCommunityLevel(null);
            setUnreadMessages(0);
            setUnreadNotificationsCount(0);
            dataCache.clear('current_user');
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
          setImageCount(2500); 
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


  const handleLogin = async () => {
    try {
      const currentUrl = window.location.href;
      await base44.auth.redirectToLogin(currentUrl);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await base44.auth.logout();
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
  const progressPercent = Math.min(100, imageCount / goalCount * 100);

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
    if (pageConfigs.length === 0) {
      return FALLBACK_NAV_ITEMS;
    }

    const enabled = pageConfigs.filter(p => p.is_enabled).sort((a, b) => a.order - b.order);
    
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
                                  Egg, LayoutGrid, CircleUser, UsersRound, Images, Tag, CalendarDays
                                };
                                const IconComponent = iconMap[item.icon] || Database;
            
            return (
              <Link
                key={item.page_name}
                to={itemUrl}
                onClick={handleNavClick}
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
      <style>
        {`
          html, body, #root {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            overflow-x: hidden;
          }

          .app-container-outline {
            width: 100%;
            min-height: 100vh; /* Changed from height to min-height for better compatibility */
            display: flex;
            background: linear-gradient(135deg, #0a0f0a 0%, #1a2920 100%);
            font-family: 'Inter', system-ui, sans-serif;
          }

          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

          @supports (display-mode: standalone) {
            .app-container-outline {
              min-height: 100vh !important; /* Use min-height for safety */
              padding-top: env(safe-area-inset-top) !important;
              padding-bottom: env(safe-area-inset-bottom) !important;
            }
          }

          .gecko-glow {
            box-shadow: 
              0 0 20px rgba(134, 239, 172, 0.3),
              0 0 40px rgba(134, 239, 172, 0.2),
              inset 0 1px 0 rgba(255, 255, 255, 0.1);
          }

          .gecko-shimmer {
            background: linear-gradient(
              45deg,
              rgba(134, 239, 172, 0.1) 0%,
              rgba(167, 243, 208, 0.2) 25%,
              rgba(74, 222, 128, 0.3) 50%,
              rgba(167, 243, 208, 0.2) 75%,
              rgba(134, 239, 172, 0.1) 100%
            );
            background-size: 200% 200%;
            animation: shimmer 3s ease-in-out infinite;
          }

          @keyframes shimmer {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }

          .gecko-scale-pattern {
            background-image: 
              radial-gradient(circle at 20% 50%, rgba(134, 239, 172, 0.1) 2px, transparent 2px),
              radial-gradient(circle at 80% 50%, rgba(74, 222, 128, 0.1) 1px, transparent 1px),
              radial-gradient(circle at 40% 20%, rgba(167, 243, 208, 0.08) 1px, transparent 1px),
              radial-gradient(circle at 60% 80%, rgba(134, 239, 172, 0.06) 2px, transparent 2px);
            background-size: 30px 30px, 25px 25px, 40px 40px, 35px 35px;
            background-position: 0 0, 15px 15px, 5px 10px, 25px 5px;
            }

            .safe-area-bottom {
            padding-bottom: env(safe-area-inset-bottom);
            }

          :root {
            --gecko-primary: #86efac;
            --gecko-secondary: #a7f3d0;
            --gecko-accent: #4ade80;
            --gecko-dark: #064e3b;
            --gecko-darker: #022c22;
            --gecko-surface: rgba(20, 83, 45, 0.4);
            --gecko-surface-light: rgba(134, 239, 172, 0.1);
            --gecko-text: #d1fae5;
            --gecko-text-muted: #a7f3d0;
            --gecko-border: rgba(134, 239, 172, 0.2);
            --gecko-hover: rgba(134, 239, 172, 0.15);
            
            --sage-50: #ecfdf5;
            --sage-100: #d1fae5;
            --sage-200: #a7f3d0;
            --sage-300: #6ee7b7;
            --sage-400: #34d399;
            --sage-500: #10b981;
            --sage-600: #059669;
            --sage-700: #047857;
            --sage-800: #065f46;
            --sage-900: #064e3b;

            --earth-50: #fef7f0;
            --earth-100: #fdeee0;
            --earth-200: #f9d5b5;
            --earth-300: #f4b885;
            --earth-400: #ed9455;
            --earth-500: #e67e22;
            --earth-600: #d35400;
            --earth-700: #b7472a;
            --earth-800: #8e3a16;
            --earth-900: #6f2e0c;
          }

          .dark {
            --sage-50: #064e3b;
            --sage-100: #065f46;
            --sage-200: #047857;
            --sage-300: #059669;
            --sage-400: #10b981;
            --sage-500: #34d399;
            --sage-600: #6ee7b7;
            --sage-700: #a7f3d0;
            --sage-800: #d1fae5;
            --sage-900: #ecfdf5;

            --earth-50: #6f2e0c;
            --earth-100: #8e3a16;
            --earth-200: #b7472a;
            --earth-300: #d35400;
            --earth-400: #e67e22;
            --earth-500: #ed9455;
            --earth-600: #f4b885;
            --earth-700: #f9d5b5;
            --earth-800: #fdeee0;
            --earth-900: #fef7f0;
          }

          body {
            background: linear-gradient(135deg, #0a0f0a 0%, #1a2920 100%);
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            color: var(--gecko-text);
            font-weight: 400;
          }

          .dark .bg-white,
          .dark .bg-white\\/80,
          .dark .bg-white\\/90 {
            background: rgba(20, 83, 45, 0.6) !important;
            backdrop-filter: blur(20px) saturate(180%);
            border: 1px solid var(--gecko-border);
            box-shadow: 
              0 8px 32px rgba(0, 0, 0, 0.4),
              inset 0 1px 0 rgba(255, 255, 255, 0.1);
          }

          .dark .bg-slate-900,
          .dark .bg-gray-900 {
            background: rgba(4, 120, 87, 0.3) !important;
            backdrop-filter: blur(15px);
            border: 1px solid var(--gecko-border);
          }

          .dark .bg-slate-800,
          .dark .bg-gray-800 {
            background: rgba(6, 95, 70, 0.4) !important;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(134, 239, 172, 0.15);
          }

          .dark .bg-slate-950 {
            background: linear-gradient(135deg, 
              rgba(2, 44, 34, 0.95) 0%, 
              rgba(6, 78, 59, 0.9) 50%, 
              rgba(4, 120, 87, 0.8) 100%) !important;
            position: relative;
          }

          .dark .bg-slate-950::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
              radial-gradient(ellipse at top, rgba(134, 239, 172, 0.03) 0%, transparent 50%),
              radial-gradient(ellipse at bottom right, rgba(74, 222, 128, 0.02) 0%, transparent 50%);
            pointer-events: none;
          }

          .dark button:not([data-state]),
          .dark .bg-gray-100,
          .dark .bg-gray-200,
          .dark .bg-slate-100,
          .dark .bg-slate-200 {
            background: rgba(6, 95, 70, 0.6) !important;
            color: var(--gecko-text) !important;
            border: 1px solid var(--gecko-border) !important;
            backdrop-filter: blur(10px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            font-weight: 500;
          }

          /* Fix Switch and Toggle visibility */
          .dark [data-state="checked"],
          .dark [data-state="unchecked"] {
            opacity: 1 !important;
          }

          .dark [role="switch"] {
            background: rgba(100, 116, 139, 0.8) !important;
            border: 1px solid rgba(148, 163, 184, 0.4) !important;
          }

          .dark [role="switch"][data-state="checked"] {
            background: var(--gecko-accent) !important;
            border-color: var(--gecko-accent) !important;
          }

          .dark [role="switch"] span,
          .dark [role="switch"] > span {
            background: white !important;
          }

          /* GLOBAL FIX: All Select/Dropdown/Menu visibility */
          [data-radix-popper-content-wrapper] {
            z-index: 99999 !important;
          }

          .dark [role="listbox"],
          .dark [data-radix-select-content],
          .dark [data-radix-select-viewport],
          .dark [data-radix-menu-content],
          .dark [data-radix-dropdown-menu-content],
          .dark [role="menu"],
          [role="listbox"],
          [data-radix-select-content],
          [data-radix-select-viewport] {
            background: rgba(6, 78, 59, 0.95) !important;
            background-color: rgba(6, 78, 59, 0.95) !important;
            border: 1px solid #059669 !important;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8) !important;
            z-index: 99999 !important;
          }

          .dark [role="option"],
          .dark [cmdk-item],
          .dark [role="menuitem"],
          .dark [data-radix-collection-item],
          [role="option"],
          [data-radix-collection-item] {
            color: #d1fae5 !important;
            background: transparent !important;
          }

          .dark [role="option"]:hover,
          .dark [role="option"][data-highlighted],
          .dark [role="option"][data-state="checked"],
          .dark [cmdk-item]:hover,
          .dark [cmdk-item][data-selected],
          .dark [role="menuitem"]:hover,
          .dark [role="menuitem"][data-highlighted],
          .dark [data-radix-collection-item]:hover,
          .dark [data-radix-collection-item][data-highlighted],
          [role="option"]:hover,
          [role="option"][data-highlighted],
          [role="option"][data-state="checked"],
          [data-radix-collection-item]:hover,
          [data-radix-collection-item][data-highlighted] {
            background: #047857 !important;
            background-color: #047857 !important;
            color: white !important;
          }

          /* Fix SelectTrigger visibility - use consistent dark emerald theme */
          .dark [data-radix-select-trigger],
          .dark button[role="combobox"],
          [data-radix-select-trigger],
          button[role="combobox"] {
            background: rgba(6, 78, 59, 0.8) !important;
            border: 1px solid #059669 !important;
            color: #d1fae5 !important;
            font-size: 0.875rem !important;
          }

          .dark [data-radix-select-trigger]:hover,
          .dark button[role="combobox"]:hover,
          [data-radix-select-trigger]:hover,
          button[role="combobox"]:hover {
            background: rgba(4, 120, 87, 0.9) !important;
          }

          /* Hide file input text that shows "Choose file No file chosen" */
          input[type="file"]:not(.sr-only) {
            display: none !important;
          }

          /* CRITICAL: Force permanent vertical alignment for all interactive elements */
          button,
          [data-radix-select-trigger],
          [role="combobox"],
          input,
          select,
          .h-10,
          .h-9,
          .h-8 {
            display: inline-flex !important;
            align-items: center !important;
            vertical-align: middle !important;
            box-sizing: border-box !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            flex-shrink: 0 !important;
          }

          /* Force flex rows to align items center */
          .flex.items-center,
          .flex.gap-2,
          .flex.gap-3,
          .flex.gap-4,
          .flex.flex-wrap {
            display: flex !important;
            align-items: center !important;
          }

          /* Prevent any transform or position shifts */
          button:not(:active),
          [data-radix-select-trigger]:not([data-state="open"]),
          [role="combobox"]:not([data-state="open"]) {
            transform: none !important;
            position: relative !important;
          }

          /* Ensure SelectTrigger has consistent height */
          [data-radix-select-trigger] {
            min-height: 2.5rem !important;
            height: auto !important;
          }

          /* Fix button baseline alignment */
          button {
            line-height: 1 !important;
          }

          /* Fix all buttons to be visible */
          .dark button,
          button {
            opacity: 1 !important;
            visibility: visible !important;
          }

          /* Mobile-specific: ensure all interactive elements visible */
          @media (max-width: 768px) {
            button,
            [role="button"],
            [data-radix-select-trigger] {
              opacity: 1 !important;
              visibility: visible !important;
            }

            /* Force dropdown content above everything on mobile */
            [data-radix-popper-content-wrapper] {
              z-index: 999999 !important;
            }
          }

          .dark button:hover,
          .dark .hover\\:bg-gray-50:hover,
          .dark .hover\\:bg-gray-100:hover,
          .dark .hover\\:bg-slate-50:hover,
          .dark .hover\\:bg-slate-100:hover {
            background: rgba(16, 185, 129, 0.2) !important;
            border-color: var(--gecko-accent) !important;
            box-shadow: 0 0 20px rgba(134, 239, 172, 0.2);
            transform: translateY(-1px);
          }

          .dark button[class*="bg-emerald"],
          .dark button[class*="bg-green"] {
            background: linear-gradient(135deg, var(--gecko-accent) 0%, var(--gecko-primary) 100%) !important;
            border: none !important;
            color: var(--gecko-dark) !important;
            font-weight: 600;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
          }

          .dark button[class*="bg-emerald"]:hover,
          .dark button[class*="bg-green"]:hover {
            background: linear-gradient(135deg, #22c55e 0%, #86efac 100%) !important;
            box-shadow: 
              0 0 25px rgba(134, 239, 172, 0.4),
              0 8px 32px rgba(0, 0, 0, 0.3);
            transform: translateY(-2px);
          }

          .dark input,
          .dark textarea,
          .dark select,
          .dark [role="combobox"] {
            background: rgba(4, 120, 87, 0.4) !important;
            border: 1px solid var(--gecko-border) !important;
            color: var(--gecko-text) !important;
            backdrop-filter: blur(10px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .dark input:focus,
          .dark textarea:focus,
          .dark select:focus,
          .dark [role="combobox"]:focus {
            border-color: var(--gecko-accent) !important;
            box-shadow: 
              0 0 0 3px rgba(134, 239, 172, 0.1),
              0 0 20px rgba(134, 239, 172, 0.2) !important;
            background: rgba(6, 95, 70, 0.6) !important;
          }

          .dark .text-slate-100,
          .dark .text-slate-200,
          .dark .text-white {
            color: var(--gecko-text) !important;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
          }

          .dark .text-slate-400,
          .dark .text-slate-500,
          .dark .text-gray-400,
          .dark .text-gray-500 {
            color: var(--gecko-text-muted) !important;
          }

          .dark .border-slate-700,
          .dark .border-gray-700 {
            border-color: var(--gecko-border) !important;
          }

          .dark [data-state="checked"] {
            background-color: var(--gecko-accent) !important;
            border-color: var(--gecko-accent) !important;
          }

          .dark .bg-emerald-600 {
            background: linear-gradient(135deg, var(--gecko-accent) 0%, var(--gecko-primary) 100%) !important;
          }

          .dark .hover\\:bg-emerald-700:hover {
            background: linear-gradient(135deg, #22c55e 0%, #86efac 100%) !important;
          }

          .notification-badge {
                            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                            color: white;
                            border-radius: 50%;
                            width: 18px;
                            height: 18px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 10px;
                            font-weight: 700;
                            border: 2px solid var(--gecko-dark);
                            box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
                            animation: pulse-notification 2s infinite;
                          }

                          @keyframes pulse-notification {
                            0%, 100% { transform: scale(1); }
                            50% { transform: scale(1.1); }
                          }

                          /* Toast fade out animation */
                          [data-state="closed"] {
                            animation: toast-fade-out 0.3s ease-out forwards;
                          }

                          @keyframes toast-fade-out {
                            from { opacity: 1; transform: translateY(0); }
                            to { opacity: 0; transform: translateY(-10px); }
                          }

          .gecko-card {
            background: rgba(6, 95, 70, 0.4);
            backdrop-filter: blur(15px) saturate(180%);
            border: 1px solid var(--gecko-border);
            border-radius: 16px;
            overflow: hidden;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
          }

          .gecko-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--gecko-primary), transparent);
            opacity: 0;
            transition: opacity 0.3s ease;
          }

          .gecko-card:hover {
            transform: translateY(-8px) scale(1.02);
            border-color: var(--gecko-accent);
            box-shadow: 
              0 20px 40px rgba(0, 0, 0, 0.4),
              0 0 60px rgba(134, 239, 172, 0.2),
              inset 0 1px 0 rgba(134, 239, 172, 0.1);
          }

          .gecko-card:hover::before {
            opacity: 1;
          }

          .sidebar-nav-item {
            backdrop-filter: blur(10px);
            border-radius: 12px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
          }

          .sidebar-nav-item::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 3px;
            background: var(--gecko-accent);
            opacity: 0;
            transition: opacity 0.3s ease;
          }

          .sidebar-nav-item.active {
            background: rgba(16, 185, 129, 0.15);
            border-left: 3px solid var(--gecko-accent);
            color: var(--gecko-primary);
          }

          .sidebar-nav-item.active::before {
            opacity: 1;
          }

          .sidebar-nav-item:hover {
            background: rgba(16, 185, 129, 0.35) !important;
            transform: translateX(4px);
            color: var(--gecko-primary) !important;
            box-shadow: 0 0 25px rgba(134, 239, 172, 0.4), inset 0 0 15px rgba(134, 239, 172, 0.15) !important;
          }

          .gecko-progress {
            background: rgba(4, 120, 87, 0.3);
            border-radius: 8px;
            overflow: hidden;
            position: relative;
          }

          .gecko-progress::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, 
              transparent 25%, 
              rgba(134, 239, 172, 0.1) 25%, 
              rgba(134, 239, 172, 0.1) 50%, 
              transparent 50%, 
              transparent 75%, 
              rgba(134, 239, 172, 0.1) 75%);
            background-size: 20px 20px;
            animation: progress-stripes 1s linear infinite;
            opacity: 0;
          }

          .gecko-progress.active::before {
            opacity: 1;
          }

          @keyframes progress-stripes {
            0% { background-position: 0 0; }
            100% { background-position: 20px 0; }
          }

          .gecko-badge {
            background: linear-gradient(135deg, var(--gecko-accent), var(--gecko-primary));
            color: var(--gecko-dark);
            border-radius: 20px;
            padding: 4px 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 2px 8px rgba(134, 239, 172, 0.3);
            border: 1px solid rgba(134, 239, 172, 0.5);
          }

          .gecko-header {
            background: linear-gradient(135deg, 
              rgba(6, 95, 70, 0.8) 0%, 
              rgba(4, 120, 87, 0.6) 100%);
            backdrop-filter: blur(20px) saturate(180%);
            border-bottom: 1px solid var(--gecko-border);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          }

          .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
          }

          .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(4, 120, 87, 0.2);
            border-radius: 4px;
          }

          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: linear-gradient(135deg, var(--gecko-accent), var(--gecko-primary));
            border-radius: 4px;
            border: 1px solid rgba(134, 239, 172, 0.3);
          }

          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(135deg, #22c55e, #86efac);
            box-shadow: 0 0 10px rgba(134, 239, 172, 0.4);
          }

          .animate-float {
            animation: float 6s ease-in-out infinite;
          }

          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }

          .text-glow {
            text-shadow: 0 0 20px rgba(134, 239, 172, 0.5);
          }

          .loading-spinner {
            border: 3px solid rgba(134, 239, 172, 0.2);
            border-top: 3px solid var(--gecko-accent);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

      <div style={{ display: 'none' }}>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Geck Inspect" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
      </div>

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
                        src={user.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=84A98C&color=fff`} 
                        alt="User avatar" 
                        className="w-8 h-8 rounded-full object-cover"
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
              <Link to={createPageUrl("Donations")} className="block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-pink-600 hover:text-pink-800 border-pink-300 hover:bg-pink-50 dark:text-pink-400 dark:hover:text-pink-300 dark:border-pink-700 dark:hover:bg-pink-900/20 text-sm"
                >
                  <Heart className="w-4 h-4 mr-2" />
                  Support This Project
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
              <Link to={createPageUrl("Subscription")} className="block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-sage-600 hover:text-sage-700 border-sage-300 text-sm"
                >
                  <Star className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">Subscription</span>
                </Button>
              </Link>

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
                            src={user.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=84A98C&color=fff`}
                            alt="User avatar"
                            className="w-8 h-8 rounded-full object-cover"
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
                  <Link to={createPageUrl("Donations")} className="block">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-pink-600 hover:text-pink-800 border-pink-300 hover:bg-pink-50 dark:text-pink-400 dark:hover:text-pink-300 dark:border-pink-700 dark:hover:bg-pink-900/20 text-sm"
                    >
                      <Heart className="w-4 h-4 mr-2" />
                      Support This Project
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

                  <Link to={createPageUrl("Subscription")} className="block">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-sage-600 hover:text-sage-700 border-sage-300 text-sm"
                    >
                      <Star className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="truncate">Subscription</span>
                    </Button>
                  </Link>

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
                {user ?
                  <>
                    <Link to={createPageUrl("Messages")} className="relative hover:bg-sage-200 p-2 rounded-lg transition-colors duration-200">
                      <Mail className="w-5 h-5 text-sage-600" />
                      {unreadMessages > 0 && <span className="notification-badge">{unreadMessages}</span>}
                    </Link>
                    <div className="relative">
                      <Link to={createPageUrl("Notifications")} className="relative hover:bg-sage-200 p-2 rounded-lg transition-colors duration-200 block">
                        <Bell className="w-5 h-5 text-sage-600" />
                      </Link>
                      {unreadNotificationsCount > 0 && <span className="notification-badge pointer-events-none">{unreadNotificationsCount}</span>}
                    </div>
                    <Link to={createPageUrl("MyProfile")} className="hover:bg-sage-200 p-2 rounded-lg transition-colors duration-200">
                      <Users className="w-5 h-5 text-sage-600" />
                    </Link>
                  </> :
                  <Button onClick={handleLogin} size="sm" className="bg-gradient-to-r from-sage-600 to-earth-600 hover:from-sage-700 hover:to-earth-700">
                    <UserPlus className="w-4 h-4 mr-1" />
                    Login
                  </Button>
                }
              </div>
            </div>
          </header>

          <header className="bg-sage-200/90 backdrop-blur-md border-b border-sage-300 px-4 py-3 hidden md:flex sticky top-0 z-10 gecko-header">
            <div className="flex items-center justify-between gap-4 w-full">
              <div></div>

              <div className="flex items-center gap-2">
                {user ?
                  <>
                    <Link to={createPageUrl("Messages")} className="relative hover:bg-sage-200 p-2 rounded-lg transition-colors duration-200">
                      <Mail className="w-5 h-5 text-sage-600" />
                      {unreadMessages > 0 && <span className="notification-badge">{unreadMessages}</span>}
                    </Link>
                     <div className="relative">
                       <Link to={createPageUrl("Notifications")} className="relative hover:bg-sage-200 p-2 rounded-lg transition-colors duration-200 block">
                         <Bell className="w-5 h-5 text-sage-600" />
                       </Link>
                       {unreadNotificationsCount > 0 && <span className="notification-badge pointer-events-none">{unreadNotificationsCount}</span>}
                    </div>
                    <Link to={createPageUrl("MyProfile")} className="hover:bg-sage-200 p-2 rounded-lg transition-colors duration-200">
                      <Users className="w-5 h-5 text-sage-600" />
                    </Link>
                  </> :
                  <Button onClick={handleLogin} size="sm" className="bg-gradient-to-r from-sage-600 to-earth-600 hover:from-sage-700 to-earth-700">
                    <UserPlus className="w-4 h-4 mr-1" />
                    Login
                  </Button>
                }
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto overflow-x-hidden">
            {children}
          </div>


          </main>
      </div>
      <TutorialModal isOpen={showTutorial} onClose={() => setShowTutorial(false)} />
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