import React, { useState, useEffect } from 'react';
import { User } from '@/entities/User';
import { UploadFile } from '@/integrations/Core';
import { useToast } from "@/components/ui/use-toast";
import usePageSettings from '@/hooks/usePageSettings';
import IdLogicSettings, { DEFAULT_ID_SETTINGS } from '@/components/settings/IdLogicSettings';
import PushNotificationsCard from '@/components/settings/PushNotificationsCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Settings, Upload, Save, Globe, Eye, X, Camera, Mail, Calendar, Loader2, Search, Trash2, AlertTriangle, ArrowUpDown, Clock, Crown, FileText, Palette, Check, Star, Database
} from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';
import { FALLBACK_NAV_ITEMS, NAV_ICON_MAP, FAVORITES_MAX, flattenNavItems } from '@/lib/navItems';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Appearance — two independent pickers. Theme drives backgrounds /
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
                        className={`text-left rounded-lg border p-4 transition-colors flex items-start gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
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
                        Sets the overall mood — backgrounds, surfaces, and neutrals
                        across the app.
                    </p>
                </div>
                {renderGrid(themes, theme, setTheme)}
            </div>

            <div className="space-y-4">
                <div>
                    <h3 className="font-semibold text-slate-100">Accent color</h3>
                    <p className="text-sm text-slate-400 mt-1">
                        Sets the brand accent — sidebar highlights, primary buttons,
                        the feedback widget, and other emerald-tinted chrome. Mix
                        with any theme.
                    </p>
                </div>
                {renderGrid(secondaryColors, secondary, setSecondary)}
            </div>
        </div>
    );
}

// Looking For Section Component
function LookingForSection({ formData, handleChange }) {
    const [newItem, setNewItem] = React.useState('');
    
    const addItem = () => {
        if (newItem.trim() && !formData.looking_for.includes(newItem.trim())) {
            handleChange('looking_for', [...formData.looking_for, newItem.trim()]);
            setNewItem('');
        }
    };
    
    const removeItem = (item) => {
        handleChange('looking_for', formData.looking_for.filter(i => i !== item));
    };
    
    return (
        <div className="space-y-3">
            <Label className="text-slate-300 flex items-center gap-2">
                <Search className="w-4 h-4" />
                Looking For (morphs/traits you want to acquire)
            </Label>
            <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="Type a morph or trait and press Enter..."
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addItem();
                    }
                }}
                className="bg-slate-800 border-slate-600 text-slate-100"
            />
            <div className="flex flex-wrap gap-2">
                {formData.looking_for.map((item) => (
                    <Badge key={item} className="flex items-center gap-1 bg-emerald-900/50 text-emerald-200 border-emerald-600">
                        {item}
                        <button onClick={() => removeItem(item)}><X className="w-3 h-3" /></button>
                    </Badge>
                ))}
            </div>
            <p className="text-xs text-slate-500">These will be displayed on your public profile in Community Connect</p>
        </div>
    );
}

// Favorite Pages Section — lets the user pin up to FAVORITES_MAX pages
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
                            className={`relative flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
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
                                <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-[10px] font-bold text-emerald-950">
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

const initialFormData = {
    bio: '',
    location: '',
    city: '',
    state_province: '',
    country: '',
    region: '',
    business_name: '',
    profile_image_url: '',
    cover_image_url: '',
    is_public_profile: true,
    show_username_on_images: true,
    allow_profile_clicks: true,
    website_url: '',
    instagram_handle: '',
    facebook_url: '',
    youtube_url: '',
    tiktok_handle: '',
    breeder_name: '',
    years_experience: '',
    specialties: [],
    looking_for: [],
    email_contact: '',
    phone_contact: '',
    business_address: '',
    email_notifications_enabled: true,
    email_notification_types: ['level_up', 'expert_status', 'new_message', 'new_follower', 'following_activity', 'gecko_of_day', 'forum_replies', 'breeding_updates', 'announcements'],
    push_notifications_enabled: false,
    push_notification_types: ['new_message', 'marketplace_inquiry', 'hatch_alert', 'feeding_due', 'new_comment', 'new_reply', 'announcement'],
    calendar_alerts_enabled: true,
    calendar_alert_types: ['egg_lay_estimate', 'hatch_estimate', 'breeding_reminders', 'weight_check_reminders'],
    feeding_alerts_enabled: true,
    feeding_late_reminders_enabled: false,
    cgd_reorder_reminders_enabled: true,
    palm_street_sync_enabled: false,
    email_on_new_follower: true,
    email_on_new_message: true,
    email_on_following_activity: true,
    default_gecko_sort: 'name',
    default_reptile_sort: 'name',
    default_gallery_sort: '-created_date',
    default_breeding_sort: '-created_date',
    hatch_alert_days: 60,
    is_featured_breeder: false,
    store_policy: '',
    favorite_page_names: [],
};

// Email preference keys — legacy grouping-keys that predate the push
// work. Keeping them stable so existing users don't get their
// preferences silently reset.
const notificationTypes = [
    { key: 'level_up', label: 'Level Up & Achievements', description: 'When you earn new badges or reach milestones' },
    { key: 'expert_status', label: 'Expert Status Updates', description: 'Changes to your expert verification status' },
    { key: 'new_message', label: 'New Messages', description: 'When you receive direct messages from other users' },
    { key: 'new_follower', label: 'New Followers', description: 'When someone starts following you' },
    { key: 'following_activity', label: 'Following Activity', description: 'When breeders you follow list new geckos or breeding plans' },
    { key: 'gecko_of_day', label: 'Gecko of the Day', description: 'When your gecko photo is selected as featured' },
    { key: 'forum_replies', label: 'Forum Activity', description: 'Replies to your forum posts and comments' },
    { key: 'breeding_updates', label: 'Breeding Updates', description: 'Updates about your breeding plans and outcomes' },
    { key: 'announcements', label: 'Platform Announcements', description: 'Important news and feature updates' }
];

// Push preference keys — these match the actual `Notification.type`
// enum values stored in the notifications table (see
// src/components/notifications/NotificationService.jsx call sites),
// because the send-push edge function filters by that exact string.
// New hatch/feeding types are declared here first; phase 5 wires
// the producers that emit them.
const pushNotificationTypes = [
    { key: 'new_message', label: 'New Messages', description: 'Direct messages from other users' },
    { key: 'marketplace_inquiry', label: 'Marketplace Inquiries', description: 'When someone asks about one of your listings' },
    { key: 'hatch_alert', label: 'Hatch Alerts', description: 'When eggs in your incubator reach their hatch window' },
    { key: 'feeding_due', label: 'Feeding Reminders', description: 'When a feeding group or reptile is overdue for feeding' },
    { key: 'new_comment', label: 'Comments on Your Posts', description: 'Comments on your forum posts' },
    { key: 'new_reply', label: 'Replies to You', description: 'Replies to your comments' },
    { key: 'new_follower', label: 'New Followers', description: 'When someone starts following you' },
    { key: 'new_gecko_listing', label: 'Following Activity — New Listings', description: 'When breeders you follow list new geckos' },
    { key: 'new_breeding_plan', label: 'Following Activity — New Plans', description: 'When breeders you follow publish new breeding plans' },
    { key: 'future_breeding_ready', label: 'Breeding Window Ready', description: 'When one of your future breeding plans enters its pairing window' },
    { key: 'gecko_of_the_day', label: 'Gecko of the Day', description: 'When your gecko is featured' },
    { key: 'level_up', label: 'Level Up & Achievements', description: 'New badges or milestones' },
    { key: 'expert_status', label: 'Expert Status', description: 'Changes to your expert verification' },
    { key: 'submission_approved', label: 'Morph Submissions', description: 'When your morph submission is approved' },
    { key: 'announcement', label: 'Platform Announcements', description: 'Important news and feature updates' }
];

const calendarAlertTypes = [
    { key: 'egg_lay_estimate', label: 'Estimated Egg Laying', description: 'Get alerts for when your females are likely to lay eggs (30-45 days after pairing)' },
    { key: 'hatch_estimate', label: 'Estimated Hatch Dates', description: 'Get alerts for when eggs are expected to hatch (75-80 days after laying)' },
    { key: 'breeding_reminders', label: 'Breeding Season Reminders', description: 'Seasonal reminders for pairing and breeding activities' },
    { key: 'weight_check_reminders', label: 'Weight Check Reminders', description: 'Monthly reminders to weigh and check your breeding animals' }
];

export default function SettingsPage() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [formData, setFormData] = useState(initialFormData);
    const [isSaving, setIsSaving] = useState(false);
    const [newSpecialty, setNewSpecialty] = useState('');
    const [idSettings, updateIdSettings] = usePageSettings('gecko_id_settings', DEFAULT_ID_SETTINGS);
    const { toast } = useToast();

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const currentUser = await User.me();
                if (currentUser) {
                    setUser(currentUser);
                    setFormData({
                        bio: currentUser.bio || '',
                        location: currentUser.location || '',
                        city: currentUser.city || '',
                        state_province: currentUser.state_province || '',
                        country: currentUser.country || '',
                        region: currentUser.region || '',
                        business_name: currentUser.business_name || '',
                        profile_image_url: currentUser.profile_image_url || '',
                        cover_image_url: currentUser.cover_image_url || '',
                        is_public_profile: currentUser.is_public_profile !== false, // Default true
                        show_username_on_images: currentUser.show_username_on_images !== false,
                        allow_profile_clicks: currentUser.allow_profile_clicks !== false,
                        website_url: currentUser.website_url || '',
                        instagram_handle: currentUser.instagram_handle || '',
                        facebook_url: currentUser.facebook_url || '',
                        youtube_url: currentUser.youtube_url || '',
                        tiktok_handle: currentUser.tiktok_handle || '',
                        breeder_name: currentUser.breeder_name || '',
                        years_experience: currentUser.years_experience || '',
                        specialties: currentUser.specialties || [],
                        looking_for: currentUser.looking_for || [],
                        email_contact: currentUser.email_contact || '',
                        phone_contact: currentUser.phone_contact || '',
                        business_address: currentUser.business_address || '',
                        email_notifications_enabled: currentUser.email_notifications_enabled !== false,
                        email_notification_types: currentUser.email_notification_types || ['level_up', 'expert_status', 'new_message', 'new_follower', 'following_activity', 'gecko_of_day', 'forum_replies', 'breeding_updates', 'announcements'],
                        push_notifications_enabled: currentUser.push_notifications_enabled === true,
                        push_notification_types: currentUser.push_notification_types || ['new_message', 'marketplace_inquiry', 'hatch_alert', 'feeding_due', 'new_comment', 'new_reply', 'announcement'],
                        calendar_alerts_enabled: currentUser.calendar_alerts_enabled !== false,
                        calendar_alert_types: currentUser.calendar_alert_types || ['egg_lay_estimate', 'hatch_estimate', 'breeding_reminders', 'weight_check_reminders'],
                        feeding_alerts_enabled: currentUser.feeding_alerts_enabled !== false,
                        feeding_late_reminders_enabled: currentUser.feeding_late_reminders_enabled === true,
                        cgd_reorder_reminders_enabled: currentUser.cgd_reorder_reminders_enabled !== false,
                        palm_street_sync_enabled: currentUser.palm_street_sync_enabled || false,
                        email_on_new_follower: currentUser.email_on_new_follower !== false, // Default true
                        email_on_new_message: currentUser.email_on_new_message !== false, // Default true
                        email_on_following_activity: currentUser.email_on_following_activity !== false, // Default true
                        default_gecko_sort: currentUser.default_gecko_sort || 'name',
                        default_reptile_sort: currentUser.default_reptile_sort || 'name',
                        default_gallery_sort: currentUser.default_gallery_sort || '-created_date',
                        default_breeding_sort: currentUser.default_breeding_sort || '-created_date',
                        hatch_alert_days: currentUser.hatch_alert_days || 60,
                        is_featured_breeder: currentUser.is_featured_breeder === true,
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
    }, [toast]);

    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setHasUnsavedChanges(true);
    };

    const handleImageUpload = async (e, type) => {
        const file = e.target.files?.[0];
        // Reset the input so picking the same file twice still fires onChange
        if (e.target) e.target.value = '';
        if (!file) return;

        try {
            const folder = type === 'profile_image_url' ? 'profile-photos' : 'cover-photos';
            const { file_url } = await UploadFile({ file, folder });
            handleChange(type, file_url);
            toast({ title: 'Image uploaded' });
        } catch (error) {
            console.error('Image upload failed:', error);
            toast({
                title: 'Upload failed',
                description: error.message || 'There was an error uploading your image.',
                variant: 'destructive',
            });
        }
    };

    const addSpecialty = () => {
        if (newSpecialty.trim() && !formData.specialties.includes(newSpecialty.trim())) {
            handleChange('specialties', [...formData.specialties, newSpecialty.trim()]);
            setNewSpecialty('');
        }
    };

    const removeSpecialty = (specialtyToRemove) => {
        handleChange('specialties', formData.specialties.filter(s => s !== specialtyToRemove));
    };

    const toggleArrayItem = (field, item) => {
        const currentArray = formData[field] || [];
        const newArray = currentArray.includes(item)
            ? currentArray.filter(i => i !== item)
            : [...currentArray, item];
        handleChange(field, newArray);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await User.updateMyUserData(formData);
            toast({ title: "Settings Saved", description: "Your profile has been successfully updated." });
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error('Failed to update profile:', error);
            toast({ title: "Save Failed", description: "Could not save your settings. Please try again.", variant: "destructive" });
        }
        setIsSaving(false);
    };

    const renderSwitch = (id, label, description, checked, onCheckedChange) => (
        <div className="flex items-center justify-between p-4 border border-slate-700 rounded-lg bg-slate-800/50">
            <div>
                <Label htmlFor={id} className="font-medium text-slate-200">{label}</Label>
                {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
            </div>
            <div className="flex items-center gap-3">
                <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} className="data-[state=checked]:bg-emerald-500" />
                <Label htmlFor={id} className={`font-semibold text-sm ${checked ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {checked ? 'On' : 'Off'}
                </Label>
            </div>
        </div>
    );

    const renderNotificationSwitch = (notifType, checked, onToggle) => (
         <div key={notifType.key} className="flex items-start justify-between p-3 border border-slate-700 rounded-lg bg-slate-800/50">
            <div>
                <Label htmlFor={notifType.key} className="font-medium text-slate-300">{notifType.label}</Label>
                <p className="text-sm text-slate-400 mt-1">{notifType.description}</p>
            </div>
            <div className="flex items-center gap-3 ml-4 shrink-0">
                <Switch 
                    id={notifType.key} 
                    checked={checked} 
                    onCheckedChange={onToggle} 
                    className="data-[state=checked]:bg-emerald-500"
                />
                 <Label htmlFor={notifType.key} className={`font-semibold text-sm ${checked ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {checked ? 'On' : 'Off'}
                </Label>
            </div>
        </div>
    );

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }
    
    if (!user) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-center text-slate-100">
                <div>
                    <h2 className="text-2xl font-bold">Access Denied</h2>
                    <p className="text-slate-400 mt-2">You must be logged in to manage your settings.</p>
                </div>
            </div>
        );
    }

    const sectionNav = [
        { id: 'appearance', label: 'Appearance' },
        { id: 'favorite-pages', label: 'Favorite Pages' },
        { id: 'profile-photos', label: 'Profile Photos' },
        { id: 'basic-information', label: 'Basic Info' },
        { id: 'contact-information', label: 'Contact' },
        { id: 'social-media', label: 'Social' },
        { id: 'store-policy', label: 'Store Policy' },
        { id: 'privacy-settings', label: 'Privacy' },
        ...((user?.membership_tier === 'breeder' || user?.subscription_status === 'grandfathered')
            ? [{ id: 'breeder-perks', label: 'Breeder Perks' }]
            : []),
        { id: 'email-notifications', label: 'Email' },
        { id: 'calendar-alerts', label: 'Calendar' },
        { id: 'feeding-alerts', label: 'Feeding Alerts' },
        { id: 'default-sorts', label: 'Defaults' },
        { id: 'id-logic', label: 'Gecko IDs' },
        { id: 'danger-zone', label: 'Danger Zone' },
    ];

    return (
        <div className="bg-slate-950 min-h-screen text-slate-100">
            <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-emerald-600/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
                            <Settings className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold text-slate-100">Account Settings</h1>
                            <p className="text-sm text-slate-400">
                                Manage your profile, privacy, notifications, and account preferences.
                            </p>
                        </div>
                    </div>
                </div>

                {hasUnsavedChanges && (
                    <div className="sticky top-2 z-20 mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 backdrop-blur-sm px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
                        <p className="text-sm text-amber-200">You have unsaved changes.</p>
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                            {isSaving ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving</>
                            ) : (
                                <><Save className="w-4 h-4 mr-2" />Save changes</>
                            )}
                        </Button>
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Sticky section navigator — industry-standard pattern */}
                    <aside className="lg:w-56 shrink-0">
                        <nav className="lg:sticky lg:top-20 space-y-1">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold px-2 mb-2">
                                Jump to
                            </p>
                            {sectionNav.map((s) => (
                                <a
                                    key={s.id}
                                    href={`#${s.id}`}
                                    className="block text-sm text-slate-300 hover:text-emerald-300 hover:bg-slate-900/60 rounded-md px-2 py-1.5 transition-colors"
                                >
                                    {s.label}
                                </a>
                            ))}
                        </nav>
                    </aside>

                    <div className="flex-1 min-w-0 space-y-8">
                <section id="appearance">
                <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-slate-100 flex items-center gap-2">
                            <Palette className="w-5 h-5" />
                            Appearance
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                            Color theme for the whole app.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <AppearanceSection />
                    </CardContent>
                </Card>
                </section>

                <section id="favorite-pages">
                <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm">
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
                            onChange={(next) => handleChange('favorite_page_names', next)}
                        />
                    </CardContent>
                </Card>
                </section>

                <section id="profile-photos">
                <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-slate-100">Profile Photos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-slate-300">Cover Photo</Label>
                            <div className="relative w-full h-32 bg-slate-800 rounded-lg overflow-hidden border border-slate-600">
                                {formData.cover_image_url ? <img src={formData.cover_image_url} alt="Cover" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-500"><Camera className="w-8 h-8" /></div>}
                                <Button asChild variant="outline" size="sm" className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70">
                                    <label className="cursor-pointer"><Upload className="w-4 h-4 mr-2" />Upload<input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'cover_image_url')} /></label>
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Profile Photo</Label>
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-20 rounded-full overflow-hidden border border-slate-600 bg-slate-800">
                                    {formData.profile_image_url ? <img src={formData.profile_image_url} alt="Profile" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-500"><Camera className="w-6 h-6" /></div>}
                                </div>
                                <Button asChild variant="outline" className="bg-slate-800 hover:bg-slate-700">
                                    <label className="cursor-pointer"><Upload className="w-4 h-4 mr-2" />Upload Photo<input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'profile_image_url')} /></label>
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                </section>

                <section id="basic-information">
                <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm">
                    <CardHeader><CardTitle className="text-slate-100">Basic Information</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="business_name" className="text-slate-300">Business Name</Label>
                                <Input id="business_name" value={formData.business_name} onChange={(e) => handleChange('business_name', e.target.value)} placeholder="Your breeder/business name" className="bg-slate-800 border-slate-600 text-slate-100" />
                            </div>
                            <div>
                                <Label htmlFor="city" className="text-slate-300">City</Label>
                                <Input id="city" value={formData.city} onChange={(e) => handleChange('city', e.target.value)} placeholder="Your city" className="bg-slate-800 border-slate-600 text-slate-100" />
                            </div>
                            <div>
                                <Label htmlFor="state_province" className="text-slate-300">State/Province</Label>
                                <Input id="state_province" value={formData.state_province} onChange={(e) => handleChange('state_province', e.target.value)} placeholder="Your state or province" className="bg-slate-800 border-slate-600 text-slate-100" />
                            </div>
                            <div>
                                <Label htmlFor="country" className="text-slate-300">Country</Label>
                                <Input id="country" value={formData.country} onChange={(e) => handleChange('country', e.target.value)} placeholder="Your country" className="bg-slate-800 border-slate-600 text-slate-100" />
                            </div>
                            <div>
                                <Label htmlFor="region" className="text-slate-300">Region</Label>
                                <Input id="region" value={formData.region} onChange={(e) => handleChange('region', e.target.value)} placeholder="e.g., Northeast, Europe" className="bg-slate-800 border-slate-600 text-slate-100" />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="bio" className="text-slate-300">Bio</Label>
                            <Textarea id="bio" value={formData.bio} onChange={(e) => handleChange('bio', e.target.value)} placeholder="Tell others about yourself..." className="h-24 bg-slate-800 border-slate-600 text-slate-100" />
                        </div>
                        <div>
                            <Label htmlFor="years_experience" className="text-slate-300">Years of Experience</Label>
                            <Input id="years_experience" type="number" value={formData.years_experience} onChange={(e) => handleChange('years_experience', e.target.value ? parseInt(e.target.value) : '')} placeholder="How many years?" className="bg-slate-800 border-slate-600 text-slate-100" />
                        </div>
                        <div className="space-y-3">
                            <Label className="text-slate-300">Specialties/Morphs</Label>
                            <Input
                                value={newSpecialty}
                                onChange={(e) => setNewSpecialty(e.target.value)}
                                placeholder="Type a specialty and press Enter..."
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addSpecialty();
                                    }
                                }}
                                className="bg-slate-800 border-slate-600 text-slate-100"
                            />
                            <div className="flex flex-wrap gap-2">
                                {formData.specialties.map((specialty) => (
                                    <Badge key={specialty} variant="secondary" className="flex items-center gap-1 bg-slate-700 text-slate-200 border-slate-600">
                                        {specialty}
                                        <button onClick={() => removeSpecialty(specialty)}><X className="w-3 h-3" /></button>
                                    </Badge>
                                ))}
                            </div>
                        </div>
                        <LookingForSection formData={formData} handleChange={handleChange} />
                    </CardContent>
                </Card>
                </section>

                <section id="contact-information">
                <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm">
                    <CardHeader><CardTitle className="text-slate-100 flex items-center gap-2"><Mail className="w-5 h-5"/>Contact Information</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div><Label htmlFor="email_contact" className="text-slate-300">Contact Email</Label><Input id="email_contact" value={formData.email_contact} onChange={(e) => handleChange('email_contact', e.target.value)} placeholder="your.email@example.com" className="bg-slate-800 border-slate-600 text-slate-100" /></div>
                        <div><Label htmlFor="phone_contact" className="text-slate-300">Phone Number</Label><Input id="phone_contact" value={formData.phone_contact} onChange={(e) => handleChange('phone_contact', e.target.value)} placeholder="(555) 123-4567" className="bg-slate-800 border-slate-600 text-slate-100" /></div>
                        <div><Label htmlFor="business_address" className="text-slate-300">Business Address</Label><Textarea id="business_address" value={formData.business_address} onChange={(e) => handleChange('business_address', e.target.value)} placeholder="123 Main St, City, State 12345" className="h-20 bg-slate-800 border-slate-600 text-slate-100" /></div>
                    </CardContent>
                </Card>
                </section>

                <section id="social-media">
                <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm">
                    <CardHeader><CardTitle className="text-slate-100 flex items-center gap-2"><Globe className="w-5 h-5"/>Social Media & Website</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><Label htmlFor="website_url" className="text-slate-300">Website URL</Label><Input id="website_url" value={formData.website_url} onChange={(e) => handleChange('website_url', e.target.value)} placeholder="https://yourwebsite.com" className="bg-slate-800 border-slate-600 text-slate-100" /></div>
                            <div><Label htmlFor="instagram_handle" className="text-slate-300">Instagram Handle</Label><Input id="instagram_handle" value={formData.instagram_handle} onChange={(e) => handleChange('instagram_handle', e.target.value)} placeholder="username (no @)" className="bg-slate-800 border-slate-600 text-slate-100" /></div>
                            <div><Label htmlFor="facebook_url" className="text-slate-300">Facebook URL</Label><Input id="facebook_url" value={formData.facebook_url} onChange={(e) => handleChange('facebook_url', e.target.value)} placeholder="https://facebook.com/yourpage" className="bg-slate-800 border-slate-600 text-slate-100" /></div>
                            <div><Label htmlFor="youtube_url" className="text-slate-300">YouTube Channel</Label><Input id="youtube_url" value={formData.youtube_url} onChange={(e) => handleChange('youtube_url', e.target.value)} placeholder="https://youtube.com/yourchannel" className="bg-slate-800 border-slate-600 text-slate-100" /></div>
                            <div><Label htmlFor="tiktok_handle" className="text-slate-300">TikTok Handle</Label><Input id="tiktok_handle" value={formData.tiktok_handle} onChange={(e) => handleChange('tiktok_handle', e.target.value)} placeholder="username (no @)" className="bg-slate-800 border-slate-600 text-slate-100" /></div>
                        </div>
                    </CardContent>
                </Card>
                </section>

                <section id="store-policy">
                <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-slate-100 flex items-center gap-2"><FileText className="w-5 h-5"/>Store Policy</CardTitle>
                        <CardDescription className="text-slate-400">
                            Set your store policies for buyers — shipping terms, payment plans, health guarantees, return policy, etc. This will be visible on your public profile and storefront.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="store_policy" className="text-slate-300">Store Policy</Label>
                            <Textarea
                                id="store_policy"
                                value={formData.store_policy}
                                onChange={(e) => handleChange('store_policy', e.target.value)}
                                placeholder={"Example:\n\n• Shipping: Live arrival guaranteed. Ships FedEx Priority Overnight, Mon–Wed only. Shipping cost is buyer's responsibility.\n\n• Payment Plans: 50% deposit required to reserve. Remaining balance due before shipping. Non-refundable deposit.\n\n• Health Guarantee: 7-day health guarantee from date of arrival. Buyer must provide photos within 24 hours of delivery.\n\n• Returns: No returns after 7 days. All sales final once gecko has been feeding for the buyer.\n\n• Weight Minimum: Geckos will not ship under 3g for babies or under target weight specified in the reserve."}
                                rows={10}
                                className="bg-slate-800 border-slate-600 text-slate-100 mt-1"
                            />
                            <p className="text-xs text-slate-500 mt-1.5">Supports plain text. Tip: Use bullet points or sections to keep it organized.</p>
                        </div>
                    </CardContent>
                </Card>
                </section>

                <section id="privacy-settings">
                <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm">
                    <CardHeader><CardTitle className="text-slate-100 flex items-center gap-2"><Eye className="w-5 h-5"/>Privacy Settings</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        {renderSwitch('is-public-profile', 'Show in Community Directory / Make Profile Public', 'Allow others to find you and view your profile and collection', formData.is_public_profile, (checked) => handleChange('is_public_profile', checked))}
                        {renderSwitch('show-username', 'Show Username on Images', 'Display your name on images you upload', formData.show_username_on_images, (checked) => handleChange('show_username_on_images', checked))}
                        {renderSwitch('allow-clicks', 'Allow Profile Clicks', 'Let others click your name to view your profile', formData.allow_profile_clicks, (checked) => handleChange('allow_profile_clicks', checked))}
                        {renderSwitch('palm-sync', 'Sync with PalmStreet', 'Allows PalmStreet users to find your public profile', formData.palm_street_sync_enabled, (checked) => handleChange('palm_street_sync_enabled', checked))}
                    </CardContent>
                </Card>
                </section>

                {/* Breeder-tier only: opt in to be featured on the home dashboard.
                    Grandfathered users automatically qualify for Breeder privileges. */}
                {(user?.membership_tier === 'breeder' || user?.subscription_status === 'grandfathered') && (
                <section id="breeder-perks">
                    <Card className="bg-emerald-950/20 border-emerald-900/40 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-emerald-200 flex items-center gap-2">
                                <Crown className="w-5 h-5" /> Breeder Perks
                            </CardTitle>
                            <CardDescription className="text-emerald-300/60">
                                Benefits exclusive to the Breeder tier.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {renderSwitch(
                                'featured-breeder',
                                'Feature me on the Dashboard',
                                'Your profile, business name, and latest listings get highlighted in the home dashboard breeder rotation. Turn off any time.',
                                formData.is_featured_breeder,
                                (checked) => handleChange('is_featured_breeder', checked)
                            )}
                        </CardContent>
                    </Card>
                </section>
                )}

                <section id="email-notifications">
                <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm">
                    <CardHeader><CardTitle className="text-slate-100 flex items-center gap-2"><Mail className="w-5 h-5"/>Email Notifications</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        {renderSwitch('email-enabled', 'Enable Email Notifications', 'Master toggle for all email notifications', formData.email_notifications_enabled, (checked) => handleChange('email_notifications_enabled', checked))}
                        {formData.email_notifications_enabled && (
                            <div className="space-y-3">
                                <p className="text-sm text-slate-400 mb-2">Choose which events trigger email alerts:</p>
                                {renderSwitch('email-new-follower', 'Email on New Follower', 'Get an email when someone starts following you', formData.email_on_new_follower, (checked) => handleChange('email_on_new_follower', checked))}
                                {renderSwitch('email-new-message', 'Email on New Message', 'Get an email when you receive a direct message', formData.email_on_new_message, (checked) => handleChange('email_on_new_message', checked))}
                                {renderSwitch('email-following-activity', 'Email on Following Activity', 'Get an email when breeders you follow list new geckos or breeding plans', formData.email_on_following_activity, (checked) => handleChange('email_on_following_activity', checked))}
                                <div className="border-t border-slate-700 pt-4 mt-4">
                                    <p className="text-sm text-slate-400 mb-2">In-app notification preferences:</p>
                                    {notificationTypes.map(notifType => renderNotificationSwitch(notifType, formData.email_notification_types.includes(notifType.key), () => toggleArrayItem('email_notification_types', notifType.key)))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
                </section>

                <PushNotificationsCard
                    pushEnabled={formData.push_notifications_enabled}
                    pushTypes={formData.push_notification_types}
                    onToggleEnabled={(checked) => handleChange('push_notifications_enabled', checked)}
                    onToggleType={(key) => toggleArrayItem('push_notification_types', key)}
                    notificationTypes={pushNotificationTypes}
                    userEmail={user?.email}
                    renderSwitch={renderSwitch}
                    renderNotificationSwitch={renderNotificationSwitch}
                />

                <section id="calendar-alerts">
                <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm">
                     <CardHeader><CardTitle className="text-slate-100 flex items-center gap-2"><Calendar className="w-5 h-5"/>Calendar Alerts</CardTitle></CardHeader>
                     <CardContent className="space-y-6">
                          {renderSwitch('calendar-enabled', 'Enable Calendar Alerts', 'Auto-download .ics files for breeding events', formData.calendar_alerts_enabled, (checked) => handleChange('calendar_alerts_enabled', checked))}
                         {formData.calendar_alerts_enabled && (
                             <div className="space-y-3">
                                 {calendarAlertTypes.map(alertType => renderNotificationSwitch(alertType, formData.calendar_alert_types.includes(alertType.key), () => toggleArrayItem('calendar_alert_types', alertType.key)))}
                             </div>
                         )}
                     </CardContent>
                 </Card>
                </section>

                <section id="feeding-alerts">
                 <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm">
                     <CardHeader><CardTitle className="text-slate-100 flex items-center gap-2"><Clock className="w-5 h-5"/>Feeding Alerts</CardTitle></CardHeader>
                     <CardContent className="space-y-6">
                          {renderSwitch('feeding-alerts-enabled', 'Enable Feeding Alerts', 'Send a notification on the day each feeding group or reptile is due', formData.feeding_alerts_enabled, (checked) => handleChange('feeding_alerts_enabled', checked))}
                         {formData.feeding_alerts_enabled && (
                             <>
                                 {renderSwitch('feeding-late-reminders-enabled', 'Late Reminders', 'Keep sending daily reminders while a feeding remains overdue. Off by default — you only get one notification on the day feeding is due.', formData.feeding_late_reminders_enabled, (checked) => handleChange('feeding_late_reminders_enabled', checked))}
                                 <p className="text-sm text-slate-400">Alerts also appear in the bottom right corner while feeding is overdue. Glow turns yellow when due, orange after 2+ weeks, red after 3+ weeks.</p>
                             </>
                         )}
                         {renderSwitch('cgd-reorder-reminder', 'CGD Reorder Reminder', 'Notify me roughly 14 days before my CGD is estimated to run out, based on my collection size and order history. Disable to stop these reminders.', formData.cgd_reorder_reminders_enabled, (checked) => handleChange('cgd_reorder_reminders_enabled', checked))}
                     </CardContent>
                 </Card>
                </section>

                <section id="default-sorts">
                <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-slate-100 flex items-center gap-2">
                            <ArrowUpDown className="w-5 h-5"/>
                            Default Sort Preferences
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                            Set your preferred default sorting for different pages
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="gecko-sort" className="text-slate-300">My Geckos Default Sort</Label>
                                <Select value={formData.default_gecko_sort} onValueChange={(v) => handleChange('default_gecko_sort', v)}>
                                    <SelectTrigger className="bg-slate-800 border-slate-600">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="name">Name (A-Z)</SelectItem>
                                        <SelectItem value="-name">Name (Z-A)</SelectItem>
                                        <SelectItem value="hatch_date">Oldest First</SelectItem>
                                        <SelectItem value="-hatch_date">Newest First</SelectItem>
                                        <SelectItem value="weight_grams">Lightest First</SelectItem>
                                        <SelectItem value="-weight_grams">Heaviest First</SelectItem>
                                        <SelectItem value="status">Status (A-Z)</SelectItem>
                                        <SelectItem value="-status">Status (Z-A)</SelectItem>
                                        <SelectItem value="display_order">Custom Order</SelectItem>
                                        <SelectItem value="-created_date">Recently Added</SelectItem>
                                        <SelectItem value="created_date">Oldest Added</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div>
                                <Label htmlFor="reptile-sort" className="text-slate-300">Other Reptiles Default Sort</Label>
                                <Select value={formData.default_reptile_sort} onValueChange={(v) => handleChange('default_reptile_sort', v)}>
                                    <SelectTrigger className="bg-slate-800 border-slate-600">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="name">Name (A-Z)</SelectItem>
                                        <SelectItem value="-name">Name (Z-A)</SelectItem>
                                        <SelectItem value="species">Species (A-Z)</SelectItem>
                                        <SelectItem value="-species">Species (Z-A)</SelectItem>
                                        <SelectItem value="birth_date">Oldest First</SelectItem>
                                        <SelectItem value="-birth_date">Newest First</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div>
                                <Label htmlFor="gallery-sort" className="text-slate-300">Gallery Default Sort</Label>
                                <Select value={formData.default_gallery_sort} onValueChange={(v) => handleChange('default_gallery_sort', v)}>
                                    <SelectTrigger className="bg-slate-800 border-slate-600">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="-created_date">Newest First</SelectItem>
                                        <SelectItem value="created_date">Oldest First</SelectItem>
                                        <SelectItem value="-confidence_score">Highest Confidence</SelectItem>
                                        <SelectItem value="confidence_score">Lowest Confidence</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div>
                                <Label htmlFor="breeding-sort" className="text-slate-300">Breeding Plans Default Sort</Label>
                                <Select value={formData.default_breeding_sort} onValueChange={(v) => handleChange('default_breeding_sort', v)}>
                                    <SelectTrigger className="bg-slate-800 border-slate-600">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="newest">Newest First</SelectItem>
                                        <SelectItem value="time_newest">Paired Most Recently</SelectItem>
                                        <SelectItem value="time_oldest">Paired Longest Ago</SelectItem>
                                        <SelectItem value="eggs_high">Most Eggs</SelectItem>
                                        <SelectItem value="eggs_low">Least Eggs</SelectItem>
                                        <SelectItem value="last_egg_recent">Latest Egg Drop</SelectItem>
                                        <SelectItem value="last_egg_oldest">Oldest Egg Drop</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div>
                                <Label htmlFor="hatch-alert-days" className="text-slate-300">Hatch Alert (Days Incubating)</Label>
                                <Input
                                    id="hatch-alert-days"
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={formData.hatch_alert_days || 60}
                                    onChange={(e) => handleChange('hatch_alert_days', parseInt(e.target.value))}
                                    className="bg-slate-800 border-slate-600"
                                />
                                <p className="text-xs text-slate-400 mt-1">Eggs will be highlighted after incubating this many days</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                </section>

                <section id="id-logic">
                    <IdLogicSettings value={idSettings} onChange={(next) => updateIdSettings(next)} />
                </section>

                <section id="danger-zone">
                {/* Delete Account Section */}
                <Card className="bg-red-950/30 border-red-900/50 backdrop-blur-sm mt-8">
                    <CardHeader>
                        <CardTitle className="text-red-400 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            Danger Zone
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-slate-400 mb-4">
                            Once you delete your account, there is no going back. All your data, geckos, breeding plans, and activity will be permanently removed.
                        </p>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="bg-red-600 hover:bg-red-700">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Account
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-slate-900 border-slate-700">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="text-red-400">Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-slate-400">
                                        This action cannot be undone. This will permanently delete your account and remove all your data from our servers, including:
                                        <ul className="list-disc list-inside mt-2 space-y-1">
                                            <li>Your gecko collection</li>
                                            <li>Breeding plans and records</li>
                                            <li>Forum posts and comments</li>
                                            <li>AI training contributions</li>
                                            <li>Messages and notifications</li>
                                        </ul>
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600">Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                        className="bg-red-600 hover:bg-red-700"
                                        onClick={async () => {
                                            toast({ 
                                                title: "Account Deletion Requested", 
                                                description: "Please contact support to complete account deletion." 
                                            });
                                        }}
                                    >
                                        Yes, Delete My Account
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>
                </section>
                    </div>
                </div>
            </div>
        </div>
    );
}