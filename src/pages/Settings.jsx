import BlockedUsersCard from '@/components/settings/BlockedUsersCard';
import AccountDeletionCard from '@/components/settings/AccountDeletionCard';
import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { lazy } from '@/lib/lazyWithRetry';
import { User } from '@/entities/User';
import { UploadFile } from '@/integrations/Core';
import { useToast } from "@/components/ui/use-toast";
import usePageSettings from '@/hooks/usePageSettings';
import StorageUsageCard from '@/components/settings/StorageUsageCard';
import CollectionsCard from '@/components/settings/CollectionsCard';
import BreederStoreCard from '@/components/settings/BreederStoreCard';
import IdLogicSettings, { DEFAULT_ID_SETTINGS } from '@/components/settings/IdLogicSettings';
import PushNotificationsCard, { pushControlsAvailable } from '@/components/settings/PushNotificationsCard';
import PhoneRemindersCard from '@/components/settings/PhoneRemindersCard';
import DataExportCard from '@/components/settings/DataExportCard';
import MySupportTickets from '@/components/support/MySupportTickets';
import IotSettingsCard from '@/components/iot/IotSettingsCard';
import { IOT_SENSORS_ENABLED } from '@/lib/iotClient';
import { openBillingPortal } from '@/lib/billingPortal';
import { isNativePlatform } from '@/lib/revenuecat';
import { syncNativeCareReminders } from '@/lib/nativeCareReminders';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Settings, Upload, Globe, Eye, Camera, Mail, Loader2, Search, ArrowUpDown, Clock, Crown, FileText, Palette, Check, Star, Database, CreditCard, LogOut, TrendingUp, UserRound, MessageSquare
} from 'lucide-react';
import { resolveTier } from '@/lib/tierLimits';
import { canUseFeature } from '@/components/subscription/PlanLimitChecker';
import UpgradePlansButton from '@/components/subscription/UpgradePlansButton';
import { useTheme } from '@/lib/ThemeContext';
import { useAuth } from '@/lib/AuthContext';
import { FALLBACK_NAV_ITEMS, NAV_ICON_MAP, FAVORITES_MAX, flattenNavItems, KEEPER_MODE_STORAGE_KEY } from '@/lib/navItems';
import { supabase } from '@/lib/supabaseClient';
import { saveOnboarding } from '@/lib/onboardingState';
import SignInRequired from '@/components/shared/SignInRequired';
import PageHeader from '@/components/shared/PageHeader';
import WeighInReminderSetting from '@/components/settings/WeighInReminderSetting';
import WeeklyNotesSetting from '@/components/settings/WeeklyNotesSetting';
import TimeZoneSetting from '@/components/settings/TimeZoneSetting';
import { WEEKLY_NOTES_CHANGED_EVENT } from '@/lib/weeklyNotesConsent';
import CollectionArtworkSetting from '@/components/settings/CollectionArtworkSetting';
import useSettingsAutosave from '@/components/settings/useSettingsAutosave';
import { SaveError, SaveTick } from '@/components/settings/SaveStatus';
import { ChipListSetting, SwitchSetting, TextSetting } from '@/components/settings/SettingControls';
import NoticesTable from '@/components/settings/NoticesTable';
import { SETTINGS_TABS, resolveSettingsTarget } from '@/components/settings/settingsTabs';

// Two-factor sign-in, admins only (src/lib/mfa.js), so members never
// download it.
const SecurityCard = lazy(() => import('@/components/settings/SecurityCard'));

const STORE_POLICY_EXAMPLE = [
    "• Shipping: Live arrival guaranteed. Ships FedEx Priority Overnight, Mon-Wed only. Shipping cost is the buyer's responsibility.",
    "",
    "• Payment Plans: 50% non-refundable deposit required to reserve. Remaining balance due before shipping.",
    "",
    "• Health Guarantee: 7-day health guarantee from the date of arrival. Buyer must send unboxing photos within 24 hours of delivery.",
    "",
    "• Returns: No returns after 7 days. All sales final once the gecko has been feeding for the buyer.",
    "",
    "• Weight Minimum: Hatchlings will not ship under 3g, or under the target weight specified at reservation.",
].join("\n");

// Appearance, two independent pickers. Theme drives backgrounds /
// surfaces / sage / slate scales; Accent drives the emerald brand color
// used on buttons, the sidebar, the feedback widget, etc. Mix and match
// freely (e.g. Lavender theme + Tangerine accent). The ThemeProvider
// writes both to localStorage and sets data-theme + data-secondary on
// <html>, so the rest of the app re-tints via CSS vars.
function AppearanceSection() {
    const { theme, setTheme, themes, secondary, setSecondary, secondaryColors } = useTheme();
    const renderGrid = (items, selectedId, onPick) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((t) => {
                const selected = selectedId === t.id;
                return (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => onPick(t.id)}
                        aria-pressed={selected}
                        className={`touch:min-h-11 text-left rounded-lg border p-4 transition-colors flex items-start gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                            selected
                                ? 'border-primary bg-primary/10'
                                : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
                        }`}
                    >
                        <span
                            aria-hidden="true"
                            className="mt-0.5 inline-block w-8 h-8 rounded-full border border-black/40 shrink-0"
                            style={{ backgroundColor: t.swatch }}
                        />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-100">{t.label}</span>
                                {selected && <Check className="w-4 h-4 text-primary" />}
                            </div>
                            <p className="text-xs text-slate-400 mt-1">{t.description}</p>
                        </div>
                    </button>
                );
            })}
        </div>
    );

    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <div>
                    <h3 className="font-semibold text-slate-100">Theme</h3>
                    <p className="text-sm text-slate-400 mt-1">
                        Sets the overall mood, backgrounds, surfaces, and neutrals
                        across the app.
                    </p>
                </div>
                {renderGrid(themes, theme, setTheme)}
            </div>

            <div className="space-y-4">
                <div>
                    <h3 className="font-semibold text-slate-100">Accent color</h3>
                    <p className="text-sm text-slate-400 mt-1">
                        Sets the brand accent, sidebar highlights, primary buttons,
                        the feedback widget, and other emerald-tinted chrome. Mix
                        with any theme.
                    </p>
                </div>
                {renderGrid(secondaryColors, secondary, setSecondary)}
            </div>
        </div>
    );
}

// Favorite Pages Section, lets the user pin up to FAVORITES_MAX pages
// to a 2x2 grid at the top of the sidebar. Selected order is preserved
// (click order = grid order).
function FavoritePagesSection({ selected, onChange }) {
    const allItems = flattenNavItems(FALLBACK_NAV_ITEMS);
    const selectedSet = new Set(selected || []);
    const atLimit = (selected?.length || 0) >= FAVORITES_MAX;

    const toggle = (pageName) => {
        if (selectedSet.has(pageName)) {
            onChange(selected.filter((n) => n !== pageName));
        } else {
            if (atLimit) return;
            onChange([...(selected || []), pageName]);
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-400">
                Pick up to {FAVORITES_MAX} pages to pin at the top of your sidebar in a
                2x2 grid of larger buttons. Favorited pages are hidden from the
                regular menu below. Click in the order you want them to appear.
            </p>
            <div className="text-xs text-slate-500">
                {(selected?.length || 0)}/{FAVORITES_MAX} selected
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {allItems.map((item) => {
                    const checked = selectedSet.has(item.page_name);
                    const position = checked ? selected.indexOf(item.page_name) + 1 : null;
                    const disabled = !checked && atLimit;
                    const IconComponent = NAV_ICON_MAP[item.icon] || Database;
                    return (
                        <button
                            key={item.page_name}
                            type="button"
                            onClick={() => toggle(item.page_name)}
                            disabled={disabled}
                            aria-pressed={checked}
                            className={`touch:min-h-11 relative flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                                checked
                                    ? 'border-emerald-500 bg-emerald-900/30 text-emerald-100'
                                    : disabled
                                      ? 'border-slate-800 bg-slate-900/30 text-slate-500 cursor-not-allowed'
                                      : 'border-slate-700 bg-slate-800/50 text-slate-200 hover:border-slate-500 hover:bg-slate-800'
                            }`}
                        >
                            <IconComponent className="w-5 h-5 shrink-0" />
                            <span className="text-sm font-medium truncate flex-1">
                                {item.display_name}
                            </span>
                            {checked && (
                                <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-xs font-bold text-emerald-950">
                                    {position}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            {atLimit && (
                <p className="text-xs text-amber-300">
                    You've selected the maximum of {FAVORITES_MAX} favorites. Remove one to pick a different page.
                </p>
            )}
        </div>
    );
}

// Hidden on 12 November 2026 by decision of the experience review (finding H7); set this to true to show the Favorite Pages section again (saved favourites were left untouched in the profile).
const SHOW_FAVORITE_PAGES = false;

// The same limit sign-up puts on a display name (LoginPortal.jsx).
const DISPLAY_NAME_MAX = 60;

// The profile fields this page edits. Each one is saved on its own the
// moment it changes (useSettingsAutosave), so nothing here is ever sent
// unless the member changed that field. Fields with no control on this
// page (location and breeder name, which My Profile edits, and three old
// "email on" switches nothing reads) are not listed, so this page can no
// longer write them back with a stale value.
const initialFormData = {
    full_name: '',
    bio: '',
    city: '',
    state_province: '',
    country: '',
    region: '',
    business_name: '',
    profile_image_url: '',
    cover_image_url: '',
    is_public_profile: true,
    show_username_on_images: true,
    show_breeders_publicly: true,
    website_url: '',
    instagram_handle: '',
    facebook_url: '',
    youtube_url: '',
    tiktok_handle: '',
    years_experience: '',
    specialties: [],
    looking_for: [],
    email_contact: '',
    phone_contact: '',
    business_address: '',
    email_notifications_enabled: true,
    email_notification_types: ['level_up', 'expert_status', 'new_message', 'new_follower', 'following_activity', 'gecko_of_day', 'forum_replies', 'breeding_updates', 'announcements', 'market_alert', 'market_brief'],
    push_notifications_enabled: false,
    push_notification_types: ['new_message', 'marketplace_inquiry', 'hatch_alert', 'feeding_due', 'new_comment', 'new_reply', 'announcement', 'market_alert', 'market_brief'],
    feeding_alerts_enabled: true,
    feeding_late_reminders_enabled: false,
    market_brief_enabled: false,
    cgd_reorder_reminders_enabled: true,
    default_breeding_sort: 'incubation_longest',
    hatch_alert_days: 60,
    is_featured_breeder: false,
    morph_id_show_value_estimate: false,
    store_policy: '',
    favorite_page_names: [],
};

// Email preference keys, legacy grouping-keys that predate the push
// work. Keeping them stable so existing users don't get their
// preferences silently reset. The order here is the order of the rows
// in the notices table (care first); it has no meaning in storage.
const notificationTypes = [
    { key: 'breeding_updates', label: 'Breeding and care updates', description: 'Hatch alerts, breeding plan updates, and feeding, weigh-in, vet follow-up and Season Planner task reminders, including the two weigh-in emails in your first two weeks (day 7 and day 14)' },
    { key: 'new_message', label: 'New messages', description: 'When you receive direct messages from other members' },
    { key: 'new_follower', label: 'New followers', description: 'When someone starts following you' },
    { key: 'following_activity', label: 'Following activity', description: 'When breeders you follow list new geckos or breeding plans' },
    { key: 'forum_replies', label: 'Forum activity', description: 'Replies to your forum posts and comments' },
    { key: 'gecko_of_day', label: 'Gecko of the Day', description: 'When your gecko photo is selected as featured' },
    { key: 'level_up', label: 'Level up and achievements', description: 'When you earn new badges or reach milestones' },
    { key: 'expert_status', label: 'Expert status', description: 'Changes to your expert verification status' },
    { key: 'announcements', label: 'Platform announcements', description: 'Important news, feature updates, and the welcome emails in your first few days' },
    { key: 'market_alert', label: 'Watchlist matches', description: 'When a new listing or a price cut matches one of your market watches' },
    { key: 'market_brief', label: 'Morning Market Brief', description: 'The daily crested gecko market brief, once it is switched on under Breeder profile, Market' }
];

// Push preference keys, these match the actual `Notification.type`
// enum values stored in the notifications table (see
// src/components/notifications/NotificationService.jsx call sites),
// because the send-push edge function filters by that exact string.
// `email` is the email switch above that the same notice follows by
// email (TYPE_TO_EMAIL_KEY in supabase/functions/send-email); `shared`
// puts the push switch on that email row of the notices table, the rest
// get a row of their own under it.
const pushNotificationTypes = [
    { key: 'new_message', email: 'new_message', shared: true },
    { key: 'marketplace_inquiry', email: 'new_message', label: 'Marketplace inquiries', description: 'When someone asks about one of your listings.' },
    { key: 'hatch_alert', email: 'breeding_updates', label: 'Hatch alerts', description: 'When eggs in your incubator reach their hatch window.' },
    { key: 'feeding_due', email: 'breeding_updates', label: 'Feeding and weigh-in reminders', description: 'When a gecko or feeding group is due to be fed or weighed, vet follow-ups and Season Planner tasks.' },
    { key: 'future_breeding_ready', email: 'breeding_updates', label: 'Breeding window ready', description: 'When one of your future breeding plans enters its pairing window.' },
    { key: 'new_comment', email: 'forum_replies', label: 'Comments on your posts', description: 'Comments on your forum posts.' },
    { key: 'new_reply', email: 'forum_replies', label: 'Replies to you', description: 'Replies to your comments.' },
    { key: 'new_follower', email: 'new_follower', shared: true },
    { key: 'new_gecko_listing', email: 'following_activity', label: 'New listings from breeders you follow', description: 'When breeders you follow list new geckos.' },
    { key: 'new_breeding_plan', email: 'following_activity', label: 'New plans from breeders you follow', description: 'When breeders you follow publish new breeding plans.' },
    { key: 'gecko_of_the_day', email: 'gecko_of_day', shared: true },
    { key: 'level_up', email: 'level_up', shared: true },
    { key: 'expert_status', email: 'expert_status', shared: true },
    { key: 'submission_approved', email: 'level_up', label: 'Morph submissions', description: 'When an admin reviews a photo you sent to the Morph Guide.' },
    { key: 'announcement', email: 'announcements', shared: true },
    { key: 'market_alert', email: 'market_alert', shared: true },
    { key: 'market_brief', email: 'market_brief', shared: true }
];

// The Hatchery's sort options. default_breeding_sort is read only by the
// Hatchery (Breeding page, Hatchery tab), so the choices here must be the
// Hatchery's own values. They used to be the breeding plan sorts, which
// the Hatchery did not recognise, so the setting silently did nothing.
const HATCHERY_SORT_OPTIONS = [
    { value: 'incubation_longest', label: 'Longest incubating' },
    { value: 'incubation_shortest', label: 'Shortest incubating' },
    { value: 'hatch_date_asc', label: 'Hatching soonest' },
    { value: 'hatch_date_desc', label: 'Hatching latest' },
    { value: 'lay_date_desc', label: 'Lay date (newest)' },
    { value: 'lay_date_asc', label: 'Lay date (oldest)' },
];
const HATCHERY_SORT_VALUES = new Set(HATCHERY_SORT_OPTIONS.map((o) => o.value));

// What a field must look like before it is saved. Returns { value } to
// save a tidied value, { error } to refuse it (the control goes back to
// the saved value and shows the reason), or nothing to save it as typed.
function validateSetting(field, value) {
    if (field === 'full_name') {
        const name = String(value || '').trim().slice(0, DISPLAY_NAME_MAX);
        // Required at sign-up, so members never appear as "Geck Inspect member".
        if (!name) return { error: 'A display name is needed. It is the name other keepers see on your posts and geckos.' };
        return { value: name };
    }
    if (field === 'hatch_alert_days') {
        const days = Math.round(Number(value));
        if (!Number.isFinite(days)) return { error: 'Enter a number of days from 1 to 100.' };
        return { value: Math.min(100, Math.max(1, days)) };
    }
    return null;
}

const SECTION = 'scroll-mt-24';

export default function SettingsPage() {
    const [user, setUser] = useState(null);
    // The save reads the member from here, so a save can never start for
    // a guest or before the profile has loaded.
    const userRef = useRef(null);
    const [confirmPolicyReplaceOpen, setConfirmPolicyReplaceOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    // Weekly Gecko Notes: its own state and its own save, never one of the
    // autosaved fields, so no save from this page's form can write it.
    const [weeklyNotesEnabled, setWeeklyNotesEnabled] = useState(true);
    // The region rule (src/lib/weeklyNotesConsent.js) can turn the notes
    // off just after this page read the profile; show its result.
    useEffect(() => {
        const onChanged = (event) => {
            if (typeof event?.detail?.enabled === 'boolean') setWeeklyNotesEnabled(event.detail.enabled);
        };
        window.addEventListener(WEEKLY_NOTES_CHANGED_EVENT, onChanged);
        return () => window.removeEventListener(WEEKLY_NOTES_CHANGED_EVENT, onChanged);
    }, []);
    const [portalBusy, setPortalBusy] = useState(false);
    const [uploading, setUploading] = useState(null);
    const [idSettings, updateIdSettings] = usePageSettings('gecko_id_settings', DEFAULT_ID_SETTINGS);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const { toast } = useToast();
    const { logout, mergeUserExtras } = useAuth();
    const location = useLocation();

    // Every profile field saves on its own as it changes (finding F5).
    // A save carries only the field that changed.
    const auto = useSettingsAutosave({
        save: (patch) => User.updateMyUserData(patch),
        canSave: () => Boolean(userRef.current?.email) && !userRef.current?.is_guest,
        validate: validateSetting,
        onSaved: (field, value) => {
            // Saving with all email off also turns Weekly Gecko Notes off in
            // the database (the profiles_weekly_notes_follow_email_off
            // trigger), and turning email back on does not restart them, so
            // the switch shows what was saved.
            if (field === 'email_notifications_enabled' && value === false) setWeeklyNotesEnabled(false);
            if (field === 'feeding_alerts_enabled') {
                syncNativeCareReminders({ email: userRef.current?.email, feedingAlertsEnabled: value !== false }).catch(() => {});
            }
            // The menu shows the member's name and photo; keep it in step.
            if (field === 'full_name' || field === 'profile_image_url') {
                mergeUserExtras?.({ [field]: value }, userRef.current?.auth_user_id);
            }
        },
    });
    const formData = auto.values;
    const { reset: loadSaved, flush: flushDrafts, commit } = auto;

    // Logout lives here rather than in the sidebar. The rail was too
    // crowded to scroll on a phone, and signing out is an account action,
    // so it belongs on the account page.
    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await logout();
        } catch (error) {
            console.error('Logout failed:', error);
            setIsLoggingOut(false);
            toast({
                title: 'Could not sign out',
                description: 'Something went wrong. Please try again.',
                variant: 'destructive',
            });
        }
    };

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const currentUser = await User.me();
                if (currentUser) {
                    userRef.current = currentUser;
                    setUser(currentUser);
                    setWeeklyNotesEnabled(currentUser.email_weekly_notes_enabled !== false);
                    // A name that still equals the sign-in email was never
                    // chosen; start the field blank, as My Profile does.
                    const storedName = currentUser.full_name || '';
                    loadSaved({
                        full_name: storedName === currentUser.email ? '' : storedName,
                        bio: currentUser.bio || '',
                        city: currentUser.city || '',
                        state_province: currentUser.state_province || '',
                        country: currentUser.country || '',
                        region: currentUser.region || '',
                        business_name: currentUser.business_name || '',
                        profile_image_url: currentUser.profile_image_url || '',
                        cover_image_url: currentUser.cover_image_url || '',
                        is_public_profile: currentUser.is_public_profile !== false, // Default true
                        show_username_on_images: currentUser.show_username_on_images !== false,
                        show_breeders_publicly: currentUser.show_breeders_publicly !== false,
                        website_url: currentUser.website_url || '',
                        instagram_handle: currentUser.instagram_handle || '',
                        facebook_url: currentUser.facebook_url || '',
                        youtube_url: currentUser.youtube_url || '',
                        tiktok_handle: currentUser.tiktok_handle || '',
                        years_experience: currentUser.years_experience || '',
                        specialties: currentUser.specialties || [],
                        looking_for: currentUser.looking_for || [],
                        email_contact: currentUser.email_contact || '',
                        phone_contact: currentUser.phone_contact || '',
                        business_address: currentUser.business_address || '',
                        email_notifications_enabled: currentUser.email_notifications_enabled !== false,
                        email_notification_types: currentUser.email_notification_types || initialFormData.email_notification_types,
                        push_notifications_enabled: currentUser.push_notifications_enabled === true,
                        push_notification_types: currentUser.push_notification_types || initialFormData.push_notification_types,
                        feeding_alerts_enabled: currentUser.feeding_alerts_enabled !== false,
                        feeding_late_reminders_enabled: currentUser.feeding_late_reminders_enabled === true,
                        market_brief_enabled: currentUser.market_brief_enabled === true,
                        cgd_reorder_reminders_enabled: currentUser.cgd_reorder_reminders_enabled !== false,
                        // Older saves hold breeding plan sort values the
                        // Hatchery never understood; show its real default.
                        default_breeding_sort: HATCHERY_SORT_VALUES.has(currentUser.default_breeding_sort)
                            ? currentUser.default_breeding_sort
                            : 'incubation_longest',
                        hatch_alert_days: Number(currentUser.hatch_alert_days) || 60,
                        is_featured_breeder: currentUser.is_featured_breeder === true,
                        morph_id_show_value_estimate: currentUser.morph_id_show_value_estimate === true,
                        store_policy: currentUser.store_policy || '',
                        favorite_page_names: Array.isArray(currentUser.favorite_page_names)
                            ? currentUser.favorite_page_names.slice(0, FAVORITES_MAX)
                            : [],
                    });
                }
            } catch (error) {
                console.error("Failed to load user data:", error);
                toast({ title: "Error", description: "Could not load your data. Please try again later.", variant: "destructive" });
            }
            setIsLoading(false);
        };
        loadData();
    }, [toast, loadSaved]);

    // Text saves when focus leaves the field. Closing the tab, switching
    // apps on a phone or leaving the page by the back gesture never fires
    // that, so whatever is typed is sent then too: nothing is lost.
    useEffect(() => {
        const onHide = () => { if (document.visibilityState === 'hidden') flushDrafts(); };
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('pagehide', flushDrafts);
        return () => {
            document.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('pagehide', flushDrafts);
            flushDrafts();
        };
    }, [flushDrafts]);

    // ---- Tabs (finding J7) ----
    // The address picks the tab: /Settings?tab=reminders, or an anchor
    // such as /Settings#id-logic, which opens the tab that holds it and
    // scrolls to it. Emails, My Geckos and support replies link that way.
    const target = useMemo(
        () => resolveSettingsTarget({ search: location.search, hash: location.hash }),
        [location.search, location.hash],
    );
    const [tab, setTab] = useState(target.tab);
    const tabRef = useRef(tab);
    tabRef.current = tab;
    // A tab's cards load when it is first opened and stay loaded after,
    // so going back to a tab keeps what was typed there.
    const [opened, setOpened] = useState(() => new Set([target.tab]));

    useEffect(() => {
        setTab(target.tab);
        setOpened((prev) => {
            // An anchor the map does not know: load every tab to find it.
            if (!target.known) return new Set(SETTINGS_TABS.map((t) => t.id));
            return prev.has(target.tab) ? prev : new Set(prev).add(target.tab);
        });
    }, [target, location.key]);

    const chooseTab = (next) => {
        setTab(next);
        setOpened((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
        // Keep the address in step, so a reload or a copied link opens the
        // same tab. Written straight to the history entry: going through
        // the router would count every tab change as a page view.
        try {
            window.history.replaceState(window.history.state, '', `${window.location.pathname}?tab=${next}`);
        } catch { /* the tab still changes */ }
    };

    const signedIn = Boolean(user);
    useEffect(() => {
        if (isLoading || !signedIn || !target.anchor || typeof window === 'undefined') return undefined;
        let touched = false;
        const stop = () => { touched = true; };
        const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        const reveal = (behavior) => {
            const el = document.getElementById(target.anchor);
            if (!el) return;
            const owner = el.closest('[data-settings-tab]')?.getAttribute('data-settings-tab');
            if (owner && owner !== tabRef.current) {
                setTab(owner);
                setTimeout(() => el.scrollIntoView({ behavior, block: 'start' }), 50);
                return;
            }
            el.scrollIntoView({ behavior, block: 'start' });
        };
        const first = setTimeout(() => reveal(calm ? 'auto' : 'smooth'), 60);
        // Cards above the target load after the first scroll and push it
        // down; settle once more unless the member has started moving.
        const second = setTimeout(() => { if (!touched) reveal('auto'); }, 800);
        const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
        events.forEach((name) => window.addEventListener(name, stop, { passive: true, once: true }));
        return () => {
            clearTimeout(first);
            clearTimeout(second);
            events.forEach((name) => window.removeEventListener(name, stop));
        };
    }, [isLoading, signedIn, target, location.key]);

    // Keeper mode is an instant toggle, not a profile form field: write
    // the browser flag, save profiles.keeper_mode, tell Layout.
    const [keeperMode, setKeeperMode] = useState(() => {
        try { return localStorage.getItem(KEEPER_MODE_STORAGE_KEY) === '1'; }
        catch { return false; }
    });
    const [keeperStatus, setKeeperStatus] = useState(null);
    const keeperTimer = useRef(null);
    useEffect(() => () => clearTimeout(keeperTimer.current), []);

    const handleKeeperModeChange = async (enabled) => {
        setKeeperMode(enabled);
        try { localStorage.setItem(KEEPER_MODE_STORAGE_KEY, enabled ? '1' : '0'); } catch { /* private browsing, toggle still works for this page view */ }
        // Layout listens for this and re-filters the sidebar in place.
        window.dispatchEvent(new CustomEvent('keeper_mode_changed'));
        clearTimeout(keeperTimer.current);
        setKeeperStatus({ state: 'saving' });
        // Also saved on the profile so every device follows (audit step 32).
        const stored = await saveOnboarding(supabase, user?.email, { keeperMode: enabled });
        if (stored === false) {
            setKeeperStatus({ state: 'error', canRetry: false, message: 'Keeper mode is set on this device, but it could not be saved to your account, so other devices may not follow.' });
            return;
        }
        setKeeperStatus({ state: 'saved' });
        keeperTimer.current = setTimeout(() => setKeeperStatus(null), 2500);
    };

    const handleImageUpload = async (e, type) => {
        const file = e.target.files?.[0];
        // Reset the input so picking the same file twice still fires onChange
        if (e.target) e.target.value = '';
        if (!file) return;

        setUploading(type);
        try {
            const folder = type === 'profile_image_url' ? 'profile-photos' : 'cover-photos';
            const { file_url } = await UploadFile({ file, folder });
            // The new photo is saved to the profile as soon as it is up.
            commit(type, file_url);
        } catch (error) {
            console.error('Image upload failed:', error);
            toast({
                title: 'Upload failed',
                description: error.message || 'There was an error uploading your image.',
                variant: 'destructive',
            });
        }
        setUploading(null);
    };

    const toggleArrayItem = (field, item) => {
        const currentArray = formData[field] || [];
        const newArray = currentArray.includes(item)
            ? currentArray.filter(i => i !== item)
            : [...currentArray, item];
        commit(field, newArray);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 p-4 md:p-8">
                <div className="max-w-4xl mx-auto py-20 flex justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <SignInRequired title="Sign in to manage settings" description="Notification, privacy, and appearance settings are saved to your account." />
        );
    }

    // One plan resolver for the whole app (src/lib/tierLimits.js): it
    // counts Stripe, app store, grandfathered and admin plans alike, so an
    // app store subscriber is never shown Free here.
    const tier = resolveTier(user);
    const hasBreederPerks = tier === 'breeder' || tier === 'enterprise';
    // The morning brief and watchlist alerts are Market Intelligence
    // (Enterprise). The database only sends them on that plan, so the
    // switch is only offered there.
    const hasMarketIntelligence = canUseFeature(user, 'market_intelligence');
    const isAdmin = user.role === 'admin';
    const showPush = pushControlsAvailable();

    // ---- Membership and billing ----
    const isGrandfathered = user?.subscription_status === 'grandfathered';
    const isLifetime = user?.membership_billing_cycle === 'lifetime';
    const isPaid = tier !== 'free';
    // Only a Stripe subscription has billing to manage here.
    // Grandfathered, lifetime, referral and comped plans
    // have no recurring bill.
    const canManageBilling = isPaid && !isGrandfathered && !isLifetime && Boolean(user?.stripe_subscription_id);
    const nativeApp = isNativePlatform();
    // A website subscription is managed in Stripe on the web.
    // Inside the app that button would open a payment flow
    // outside the store, which the stores reject.
    const showStripePortal = canManageBilling && !nativeApp;
    // The plan came from the app store (RevenueCat), which
    // handles its own billing.
    const isAppStorePlan = isPaid && !canManageBilling && !isGrandfathered
        && ['keeper', 'breeder'].includes(user?.revenuecat_tier);
    const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
    const handleManageBilling = async () => {
        setPortalBusy(true);
        try {
            await openBillingPortal({ returnPath: '/Settings' });
        } catch (err) {
            toast({
                title: 'Billing portal unavailable',
                description: err?.message || 'Stripe could not open the billing portal. Email support and we will sort it out by hand.',
                variant: 'destructive',
            });
            setPortalBusy(false);
        }
    };

    const panel = (id) => ({
        value: id,
        forceMount: true,
        hidden: tab !== id,
        'data-settings-tab': id,
        className: 'mt-6 space-y-6',
    });

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8 text-slate-100">
            <div className="max-w-4xl mx-auto">
                <PageHeader
                    icon={Settings}
                    title="Settings"
                    description="Your account, the look of the app, reminders, your breeder profile and your data. Changes save as you make them."
                />

                <Tabs value={tab} onValueChange={chooseTab}>
                    <TabsList aria-label="Settings sections">
                        {SETTINGS_TABS.map((t) => (
                            <TabsTrigger key={t.id} value={t.id} aria-label={t.label}>
                                {/* Short names on a phone so all five fit without scrolling. */}
                                <span className="sm:hidden" aria-hidden="true">{t.shortLabel}</span>
                                <span className="hidden sm:inline" aria-hidden="true">{t.label}</span>
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {/* ============================ Account ============================ */}
                    <TabsContent {...panel('account')}>
                    {opened.has('account') && (
                    <>
                <section id="account-details" className={SECTION}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-slate-100 flex items-center gap-2">
                            <UserRound className="w-5 h-5" />
                            Your account
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <TextSetting
                            auto={auto}
                            field="full_name"
                            id="display-name"
                            label="Display name"
                            placeholder="The name shown on your profile"
                            maxLength={DISPLAY_NAME_MAX}
                            autoComplete="nickname"
                            hint="The name other keepers see on your profile, posts and geckos, and in greetings. Up to 60 characters."
                            inputClassName="sm:max-w-sm"
                        />
                        <div>
                            <p className="text-sm font-medium text-slate-300">Sign-in email</p>
                            <p className="mt-1.5 text-sm text-slate-100 break-all">{user.email}</p>
                            <p className="text-xs text-slate-400 mt-1.5">Your sign-in email stays private. Other members see your display name.</p>
                        </div>
                    </CardContent>
                </Card>
                </section>

                <section id="profile-photos" className={SECTION}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-slate-100 flex items-center gap-2">
                            <Camera className="w-5 h-5" />
                            Profile photos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <div className="flex min-h-5 items-center justify-between gap-2">
                                <Label className="text-slate-300">Cover photo</Label>
                                <SaveTick status={auto.status.cover_image_url} />
                            </div>
                            <div className="relative w-full h-32 bg-slate-800 rounded-lg overflow-hidden border border-slate-600">
                                {formData.cover_image_url ? <img src={formData.cover_image_url} alt="Cover" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-500"><Camera className="w-8 h-8" /></div>}
                                <Button asChild variant="outline" size="sm" className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70">
                                    <label className="cursor-pointer">
                                        {uploading === 'cover_image_url' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                                        {uploading === 'cover_image_url' ? 'Uploading' : 'Upload cover photo'}
                                        <input type="file" accept="image/*" className="hidden" disabled={uploading !== null} onChange={(e) => handleImageUpload(e, 'cover_image_url')} />
                                    </label>
                                </Button>
                            </div>
                            <SaveError status={auto.status.cover_image_url} onRetry={() => auto.retry('cover_image_url')} />
                        </div>
                        <div className="space-y-2">
                            <div className="flex min-h-5 items-center justify-between gap-2">
                                <Label className="text-slate-300">Profile photo</Label>
                                <SaveTick status={auto.status.profile_image_url} />
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-20 rounded-full overflow-hidden border border-slate-600 bg-slate-800">
                                    {formData.profile_image_url ? <img src={formData.profile_image_url} alt="Profile" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-500"><Camera className="w-6 h-6" /></div>}
                                </div>
                                <Button asChild variant="outline" className="bg-slate-800 hover:bg-slate-700">
                                    <label className="cursor-pointer">
                                        {uploading === 'profile_image_url' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                                        {uploading === 'profile_image_url' ? 'Uploading' : 'Upload profile photo'}
                                        <input type="file" accept="image/*" className="hidden" disabled={uploading !== null} onChange={(e) => handleImageUpload(e, 'profile_image_url')} />
                                    </label>
                                </Button>
                            </div>
                            <SaveError status={auto.status.profile_image_url} onRetry={() => auto.retry('profile_image_url')} />
                        </div>
                    </CardContent>
                </Card>
                </section>

                {isAdmin && (
                    <section id="security" className={SECTION}>
                        <Suspense fallback={<div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>}>
                            <SecurityCard />
                        </Suspense>
                    </section>
                )}

                <section id="membership" className={SECTION}>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-slate-100 flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-emerald-400" />
                                Membership and billing
                            </CardTitle>
                            <CardDescription className="text-slate-400">
                                You are on the {tierLabel} plan
                                {isGrandfathered ? ' (grandfathered, free for life).' : isLifetime ? ' (lifetime access, no renewals).' : isAppStorePlan ? ' (billed through the app store).' : '.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-wrap items-center gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                className="border-slate-600 text-slate-200 hover:bg-slate-800"
                                onClick={() => { window.location.href = '/Membership'; }}
                            >
                                {isPaid ? 'Compare plans' : 'See plans'}
                            </Button>
                            {showStripePortal && (
                                <Button
                                    type="button"
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                                    onClick={handleManageBilling}
                                    disabled={portalBusy}
                                >
                                    {portalBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                                    Manage billing
                                </Button>
                            )}
                            <p className="basis-full text-xs text-slate-400">
                                {nativeApp && canManageBilling
                                    ? 'This plan was purchased on the Geck Inspect website. The app cannot change it or take a card. Cancel it in a web browser if you do not want it to renew. New plans in this app are billed by the App Store or Google Play.'
                                    : showStripePortal
                                    ? 'Manage billing opens your secure Stripe portal to change plans, update your card, download invoices, or cancel.'
                                    : isAppStorePlan
                                        ? 'Your plan renews through the store. Change or cancel it in your device subscription settings.'
                                        : isPaid
                                            ? 'Your plan has no recurring bill, so there is nothing to manage here.'
                                            : nativeApp
                                                ? 'Plans bought in this app are billed by the App Store or Google Play. Cancel them in the store subscription settings.'
                                                : 'Paid plans can be cancelled anytime from this page. The free trial is optional and offered on the Membership page.'}
                            </p>
                        </CardContent>
                    </Card>
                </section>

                <section id="storage-usage" className={SECTION}>
                    <StorageUsageCard user={user} />
                </section>

                <section id="support" className={SECTION}>
                    <MySupportTickets user={user} />
                </section>

                {/* The floating feedback button is gone on phones; the form
                    opens from here (it listens for `open_feedback`). */}
                <section id="log-out" className={SECTION}>
                    <Card>
                        <CardContent className="pt-4 md:pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-slate-400">Something not working, or an idea for Geck Inspect? Tell us. Signing out only affects this device.</p>
                            <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:shrink-0">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => window.dispatchEvent(new CustomEvent('open_feedback'))}
                                >
                                    <MessageSquare className="w-4 h-4 mr-2" />Send feedback
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleLogout}
                                    disabled={isLoggingOut}
                                >
                                    {isLoggingOut ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing out</>
                                    ) : (
                                        <><LogOut className="w-4 h-4 mr-2" />Log out</>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </section>
                    </>
                    )}
                    </TabsContent>

                    {/* ============================== Look ============================== */}
                    <TabsContent {...panel('look')}>
                    {opened.has('look') && (
                    <>
                <section id="appearance" className={SECTION}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-slate-100 flex items-center gap-2">
                            <Palette className="w-5 h-5" />
                            Appearance
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                            The colors of the app and your collection artwork. Each choice applies and saves as you pick it.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <AppearanceSection />
                        <CollectionArtworkSetting user={user} />
                    </CardContent>
                </Card>
                </section>

                {SHOW_FAVORITE_PAGES && (
                <section id="favorite-pages" className={SECTION}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-slate-100 flex items-center gap-2">
                            <Star className="w-5 h-5" />
                            Favorite Pages
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                            Pin up to {FAVORITES_MAX} pages to the top of your sidebar as a 2x2 grid of larger buttons.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FavoritePagesSection
                            selected={formData.favorite_page_names}
                            onChange={(next) => commit('favorite_page_names', next)}
                        />
                    </CardContent>
                </Card>
                </section>
                )}

                <section id="keeper-mode" className={SECTION}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-slate-100 flex items-center gap-2">
                            <Eye className="w-5 h-5" />
                            Keeper mode
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                            Just keeping, not breeding? Hide the breeding and selling tools for a simpler app. You can switch back any time.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <SwitchSetting
                            id="keeper_mode"
                            label="Keeper mode"
                            description="Removes pages like Breeding, Lineage, and Business from your sidebar so your geckos, the care guide, and Morph ID stay front and center. Applies right away on this device and never touches your data."
                            checked={keeperMode}
                            onCheckedChange={handleKeeperModeChange}
                            status={keeperStatus}
                        />
                    </CardContent>
                </Card>
                </section>

                <section id="morph-id" className={SECTION}>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-slate-100 flex items-center gap-2">
                                <Crown className="w-5 h-5 text-amber-400" />
                                Morph ID preferences
                            </CardTitle>
                            <CardDescription className="text-slate-400">
                                Tune what the AI shows you when it identifies a gecko.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {isPaid ? (
                                <SwitchSetting
                                    auto={auto}
                                    field="morph_id_show_value_estimate"
                                    id="morph_id_show_value_estimate"
                                    label="Show asking prices"
                                    description="Adds the middle half of asking prices from the Price Index for the looks Morph ID finds, with how many listings each range rests on. Off by default. Asking prices on public listings, not an appraisal."
                                />
                            ) : (
                                <div className="flex items-start justify-between gap-4 p-4 border border-slate-700 rounded-lg bg-slate-800/50">
                                    <div>
                                        <Label className="font-medium text-slate-200">
                                            Show asking prices
                                        </Label>
                                        <p className="text-sm text-slate-400 mt-1">
                                            Available on Keeper and up. Upgrade to see Price Index asking prices next to your Morph ID results.
                                        </p>
                                    </div>
                                    <UpgradePlansButton
                                        limitType="morph_id"
                                        surface="morph_id_value_locked"
                                        size="sm"
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
                                    >
                                        See plans
                                    </UpgradePlansButton>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </section>
                    </>
                    )}
                    </TabsContent>

                    {/* ============================ Reminders ============================ */}
                    <TabsContent {...panel('reminders')}>
                    {opened.has('reminders') && (
                    <>
                <section id="email-notifications" className={SECTION}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-slate-100 flex items-center gap-2"><Mail className="w-5 h-5"/>Email and push notices</CardTitle>
                        <CardDescription className="text-slate-400">
                            The two master switches come first, then one row for each kind of notice.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <SwitchSetting
                                auto={auto}
                                field="email_notifications_enabled"
                                id="email-enabled"
                                label="Email notices"
                                description="Master switch for every email in the table below"
                            />
                            {showPush && (
                                <SwitchSetting
                                    auto={auto}
                                    field="push_notifications_enabled"
                                    id="push-enabled"
                                    label="Push notices"
                                    description="Master switch for push notifications across your subscribed devices"
                                />
                            )}
                        </div>
                        {/* The email column is what the email sender reads. Three
                            separate "Email on..." switches used to sit above it,
                            saved to columns nothing reads. */}
                        <NoticesTable
                            emailKinds={notificationTypes}
                            pushKinds={pushNotificationTypes}
                            emailTypes={formData.email_notification_types}
                            pushTypes={formData.push_notification_types}
                            emailOn={formData.email_notifications_enabled === true}
                            pushOn={formData.push_notifications_enabled === true}
                            showPush={showPush}
                            onToggleEmail={(key) => toggleArrayItem('email_notification_types', key)}
                            onTogglePush={(key) => toggleArrayItem('push_notification_types', key)}
                            emailStatus={auto.status.email_notification_types}
                            pushStatus={auto.status.push_notification_types}
                            onRetryEmail={() => auto.retry('email_notification_types')}
                            onRetryPush={() => auto.retry('push_notification_types')}
                        />
                        {/* Saves on its own (User.setWeeklyNotes): a column this
                            page's autosave never holds, so it cannot write it. */}
                        {formData.email_notifications_enabled && (
                            <WeeklyNotesSetting enabled={weeklyNotesEnabled} onChange={setWeeklyNotesEnabled} />
                        )}
                    </CardContent>
                </Card>
                </section>

                <PushNotificationsCard
                    onToggleEnabled={(checked) => commit('push_notifications_enabled', checked)}
                    userEmail={user?.email}
                />
                <PhoneRemindersCard email={user?.email} />

                <section id="feeding-alerts" className={SECTION}>
                 <Card>
                     <CardHeader>
                         <CardTitle className="text-slate-100 flex items-center gap-2"><Clock className="w-5 h-5"/>Care reminders</CardTitle>
                         <CardDescription className="text-slate-400">Feeding, weigh-in and hatch reminders, and when they arrive.</CardDescription>
                     </CardHeader>
                     <CardContent className="space-y-6">
                         <SwitchSetting
                             auto={auto}
                             field="feeding_alerts_enabled"
                             id="feeding-alerts-enabled"
                             label="Feeding alerts"
                             description="One reminder a day by push and email when any gecko or feeding group is due, even with the app closed"
                         />
                         {formData.feeding_alerts_enabled && (
                             <>
                                 <SwitchSetting
                                     auto={auto}
                                     field="feeding_late_reminders_enabled"
                                     id="feeding-late-reminders-enabled"
                                     label="Late reminders"
                                     description="Keep sending daily reminders while a feeding remains overdue. Off by default, you only get one notification on the day feeding is due."
                                 />
                                 <p className="text-sm text-slate-400">Alerts also appear in the bottom right corner while feeding is overdue. Glow turns yellow when due, orange after 2+ weeks, red after 3+ weeks.</p>
                             </>
                         )}
                         <WeighInReminderSetting email={user?.email} />
                         <TimeZoneSetting key={user?.email || 'none'} profile={user} email={user?.email} />
                         <SwitchSetting
                             auto={auto}
                             field="cgd_reorder_reminders_enabled"
                             id="cgd-reorder-reminder"
                             label="CGD reorder reminder"
                             description="Notify me roughly 14 days before my CGD is estimated to run out. The estimate uses your collection size and your CGD orders from the Geck Inspect store, so it starts after your first store order."
                         />
                         <TextSetting
                             auto={auto}
                             field="hatch_alert_days"
                             id="hatch-alert-days"
                             label="Hatch alert (days incubating)"
                             type="number"
                             inputMode="numeric"
                             min="1"
                             max="100"
                             toDraft={(text) => (text === '' ? NaN : parseInt(text, 10))}
                             hint="Eggs are highlighted in the Hatchery after incubating this many days."
                             inputClassName="sm:max-w-[10rem]"
                         />
                     </CardContent>
                 </Card>
                </section>

                    </>
                    )}
                    </TabsContent>

                    {/* ========================= Breeder profile ========================= */}
                    <TabsContent {...panel('breeder')}>
                    {opened.has('breeder') && (
                    <>
                {keeperMode && (
                    <p className="text-sm text-slate-400">
                        These settings are for members who breed or sell. Keeper mode hides the breeding pages, not these.
                    </p>
                )}

                <section id="basic-information" className={SECTION}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-slate-100">Breeder details</CardTitle>
                        <CardDescription className="text-slate-400">Shown on your public profile.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <TextSetting auto={auto} field="business_name" label="Business name" placeholder="Your breeder or business name" />
                            <TextSetting auto={auto} field="city" label="City" placeholder="Your city" />
                            <TextSetting auto={auto} field="state_province" label="State or province" placeholder="Your state or province" />
                            <TextSetting auto={auto} field="country" label="Country" placeholder="Your country" />
                            <TextSetting auto={auto} field="region" label="Region" placeholder="e.g., Northeast, Europe" />
                        </div>
                        <TextSetting auto={auto} field="bio" label="Bio" multiline placeholder="Tell others about yourself..." inputClassName="h-24" />
                        <TextSetting
                            auto={auto}
                            field="years_experience"
                            label="Years of experience"
                            type="number"
                            inputMode="numeric"
                            toDraft={(text) => (text ? parseInt(text, 10) : '')}
                            placeholder="How many years?"
                        />
                        <ChipListSetting
                            auto={auto}
                            field="specialties"
                            label="Specialties and morphs"
                            placeholder="Type a specialty and press Enter..."
                        />
                        <ChipListSetting
                            auto={auto}
                            field="looking_for"
                            label="Looking for (morphs or traits you want to acquire)"
                            icon={Search}
                            placeholder="Type a morph or trait and press Enter..."
                            chipClassName="bg-emerald-900/50 text-emerald-200 border-emerald-600"
                            hint="These will be displayed on your public profile."
                        />
                    </CardContent>
                </Card>
                </section>

                <section id="contact-information" className={SECTION}>
                <Card>
                    <CardHeader><CardTitle className="text-slate-100 flex items-center gap-2"><Mail className="w-5 h-5"/>Contact information</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <TextSetting auto={auto} field="email_contact" label="Contact email" type="email" placeholder="your.email@example.com" />
                        <TextSetting auto={auto} field="phone_contact" label="Phone number" type="tel" placeholder="(555) 123-4567" />
                        <TextSetting auto={auto} field="business_address" label="Business address" multiline placeholder="123 Main St, City, State 12345" inputClassName="h-20" />
                    </CardContent>
                </Card>
                </section>

                <section id="social-media" className={SECTION}>
                <Card>
                    <CardHeader><CardTitle className="text-slate-100 flex items-center gap-2"><Globe className="w-5 h-5"/>Social media and website</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <TextSetting auto={auto} field="website_url" label="Website URL" placeholder="https://yourwebsite.com" />
                            <TextSetting auto={auto} field="instagram_handle" label="Instagram handle" placeholder="username (no @)" />
                            <TextSetting auto={auto} field="facebook_url" label="Facebook URL" placeholder="https://facebook.com/yourpage" />
                            <TextSetting auto={auto} field="youtube_url" label="YouTube channel" placeholder="https://youtube.com/yourchannel" />
                            <TextSetting auto={auto} field="tiktok_handle" label="TikTok handle" placeholder="username (no @)" />
                        </div>
                    </CardContent>
                </Card>
                </section>

                <section id="store-policy" className={SECTION}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-slate-100 flex items-center gap-2"><FileText className="w-5 h-5"/>Store policy</CardTitle>
                        <CardDescription className="text-slate-400">
                            Set your store policies for buyers, shipping terms, payment plans, health guarantees, return policy, etc. This will be visible on your public profile and storefront.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <TextSetting
                            auto={auto}
                            field="store_policy"
                            label="Store policy"
                            multiline
                            rows={10}
                            placeholder={"Click 'Use example template' above to start with a sample policy, or write your own here."}
                            hint="Supports plain text. Tip: Use bullet points or sections to keep it organized."
                            labelAside={(
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2.5 text-xs border-emerald-700/60 bg-emerald-900/20 text-emerald-200 hover:bg-emerald-900/40 hover:text-emerald-100"
                                    onClick={() => {
                                        const hasContent = (formData.store_policy || '').trim().length > 0;
                                        if (hasContent) {
                                            setConfirmPolicyReplaceOpen(true);
                                            return;
                                        }
                                        commit('store_policy', STORE_POLICY_EXAMPLE);
                                    }}
                                >
                                    Use example template
                                </Button>
                            )}
                        />
                        <AlertDialog open={confirmPolicyReplaceOpen} onOpenChange={setConfirmPolicyReplaceOpen}>
                            <AlertDialogContent className="border-slate-700 bg-slate-900 text-slate-100">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="text-slate-100">
                                        Replace current store policy?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription className="text-slate-300">
                                        This will replace your current store policy text with the example template and save it. You can edit it afterwards.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700">
                                        Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => {
                                            setConfirmPolicyReplaceOpen(false);
                                            commit('store_policy', STORE_POLICY_EXAMPLE);
                                        }}
                                        className="bg-emerald-600 text-white hover:bg-emerald-500"
                                    >
                                        Replace with template
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>
                </section>

                {/* Breeder/Enterprise-tier only: opt in to be featured on the home dashboard
                    and run a custom store page. Grandfathered users automatically qualify. */}
                {hasBreederPerks && (
                <section id="breeder-perks" className={SECTION}>
                    <Card className="bg-emerald-950/20 border-emerald-900/40 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-emerald-200 flex items-center gap-2">
                                <Crown className="w-5 h-5" /> Breeder perks
                            </CardTitle>
                            <CardDescription className="text-emerald-300/60">
                                Benefits exclusive to the Breeder tier.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <SwitchSetting
                                auto={auto}
                                field="is_featured_breeder"
                                id="featured-breeder"
                                label="Feature me on the Dashboard"
                                description="Your profile, business name, and latest listings get highlighted in the home dashboard breeder rotation. Turn off any time."
                            />
                        </CardContent>
                    </Card>
                </section>
                )}

                {hasBreederPerks && (
                    <BreederStoreCard userEmail={user?.email} />
                )}

                <section id="id-logic" className={SECTION}>
                    <IdLogicSettings value={idSettings} onChange={(next) => updateIdSettings(next)} />
                </section>

                <section id="default-sorts" className={SECTION}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-slate-100 flex items-center gap-2">
                            <ArrowUpDown className="w-5 h-5"/>
                            Hatchery preferences
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                            How the Hatchery tab on the Breeding page opens. My Geckos, the Gallery and your breeding plans each remember their own sort from the settings button at the top of that page.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="sm:max-w-sm">
                            <div className="flex min-h-5 items-center justify-between gap-2">
                                <Label htmlFor="breeding-sort" className="text-slate-300">Hatchery default sort</Label>
                                <SaveTick status={auto.status.default_breeding_sort} />
                            </div>
                            <Select value={formData.default_breeding_sort} onValueChange={(v) => commit('default_breeding_sort', v)}>
                                <SelectTrigger id="breeding-sort" className="mt-1.5 bg-slate-800 border-slate-600">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {HATCHERY_SORT_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <SaveError status={auto.status.default_breeding_sort} onRetry={() => auto.retry('default_breeding_sort')} />
                        </div>
                        <p className="text-sm text-slate-400">
                            The hatch alert day count is with the other reminders.{' '}
                            <button type="button" onClick={() => chooseTab('reminders')} className="relative touch-hit text-emerald-300 underline underline-offset-2 hover:text-emerald-200">
                                Open Reminders
                            </button>
                        </p>
                    </CardContent>
                </Card>
                </section>

                <section id="market-alerts" className={SECTION}>
                 <Card>
                     <CardHeader><CardTitle className="text-slate-100 flex items-center gap-2"><TrendingUp className="w-5 h-5"/>Market</CardTitle></CardHeader>
                     <CardContent className="space-y-6">
                          {hasMarketIntelligence ? (
                              <>
                                  <SwitchSetting
                                      auto={auto}
                                      field="market_brief_enabled"
                                      id="market-brief-enabled"
                                      label="Morning Market Brief"
                                      description="One short message each morning when there is fresh crested gecko market news: new listings and price cuts in your morphs, rare morphs listed, and how the market value of your geckos moved. Nothing is sent on quiet days."
                                  />
                                  <p className="text-sm text-slate-400">Watchlist matches arrive whenever a listing fits one of your watches. Manage watches on the Market page. Both follow your email and push choices on the Reminders tab.</p>
                              </>
                          ) : (
                              <p className="text-sm text-slate-400">
                                  The Morning Market Brief and watchlist alerts are part of Market Intelligence, which is not open to new members right now.
                              </p>
                          )}
                     </CardContent>
                 </Card>
                </section>
                    </>
                    )}
                    </TabsContent>

                    {/* ========================= Data and privacy ========================= */}
                    <TabsContent {...panel('privacy')}>
                    {opened.has('privacy') && (
                    <>
                <section id="privacy-settings" className={SECTION}>
                <Card>
                    <CardHeader><CardTitle className="text-slate-100 flex items-center gap-2"><Eye className="w-5 h-5"/>Privacy</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <SwitchSetting
                            auto={auto}
                            field="is_public_profile"
                            id="is-public-profile"
                            label="Show in the community directory and make my profile public"
                            description="Allow others to find you and view your profile and collection"
                        />
                        <SwitchSetting
                            auto={auto}
                            field="show_breeders_publicly"
                            id="show-breeders-publicly"
                            label="Show my breeders publicly"
                            description="Display the Breeders tab on your public profile so other keepers can see your active breeding pairs. Turn off to keep that collection private."
                        />
                        <SwitchSetting
                            auto={auto}
                            field="show_username_on_images"
                            id="show-username"
                            label="Show my name on Gallery photos"
                            description={'Photos you share to the community Gallery say who uploaded them, with a link to your profile. Turn off and they show "a community member" instead.'}
                        />
                        {user?.id && (
                            <div className="pt-2">
                                <a
                                    href={`/PublicProfile?userId=${user.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="touch:min-h-11 inline-flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline"
                                >
                                    <Eye className="w-4 h-4" />
                                    Preview my profile as a visitor would see it
                                </a>
                                <p className="text-xs text-slate-400 mt-1">
                                    Opens your public profile in a new tab. Anything hidden by the switches above stays hidden.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
                </section>

                <section id="collections" className={SECTION}>
                    <CollectionsCard user={user} />
                </section>

                <section id="blocked-users" className={SECTION}><BlockedUsersCard user={user} /></section>

                {IOT_SENSORS_ENABLED && (
                    <section id="enclosure-sensors" className={SECTION}>
                        <IotSettingsCard user={user} />
                    </section>
                )}

                <section id="data-export" className={SECTION}>
                    <DataExportCard user={user} />
                </section>

                <section id="danger-zone" className={SECTION}><AccountDeletionCard user={user} /></section>
                    </>
                    )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
