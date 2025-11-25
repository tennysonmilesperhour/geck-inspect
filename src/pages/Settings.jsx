import React, { useState, useEffect } from 'react';
import { User } from '@/entities/User';
import { ExpertVerificationRequest } from '@/entities/ExpertVerificationRequest';
import { UploadFile } from '@/integrations/Core';
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Settings, Upload, Save, Globe, Eye, X, Plus, Camera, Mail, Award, CheckCircle, Clock, Calendar, Loader2
} from 'lucide-react';

const initialFormData = {
    bio: '',
    location: '',
    profile_image_url: '',
    cover_image_url: '',
    profile_public: false,
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
    email_contact: '',
    phone_contact: '',
    business_address: '',
    email_notifications_enabled: true,
    email_notification_types: [],
    calendar_alerts_enabled: true,
    calendar_alert_types: [],
    palm_street_sync_enabled: false
};

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
    const [expertRequest, setExpertRequest] = useState(null);
    const [showExpertRequestForm, setShowExpertRequestForm] = useState(false);
    const [expertRequestText, setExpertRequestText] = useState('');
    const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
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
                        profile_image_url: currentUser.profile_image_url || '',
                        cover_image_url: currentUser.cover_image_url || '',
                        profile_public: currentUser.profile_public || false,
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
                        email_contact: currentUser.email_contact || '',
                        phone_contact: currentUser.phone_contact || '',
                        business_address: currentUser.business_address || '',
                        email_notifications_enabled: currentUser.email_notifications_enabled !== false,
                        email_notification_types: currentUser.email_notification_types || ['level_up', 'expert_status', 'new_message', 'gecko_of_day', 'announcements'],
                        calendar_alerts_enabled: currentUser.calendar_alerts_enabled !== false,
                        calendar_alert_types: currentUser.calendar_alert_types || ['egg_lay_estimate', 'hatch_estimate', 'breeding_reminders'],
                        palm_street_sync_enabled: currentUser.palm_street_sync_enabled || false,
                    });

                    const existingRequests = await ExpertVerificationRequest.filter({ user_email: currentUser.email });
                    if (existingRequests.length > 0) {
                        setExpertRequest(existingRequests.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0]);
                    }
                }
            } catch (error) {
                console.error("Failed to load user data:", error);
                toast({ title: "Error", description: "Could not load your data. Please try again later.", variant: "destructive" });
            }
            setIsLoading(false);
        };
        loadData();
    }, [toast]);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleImageUpload = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const { file_url } = await UploadFile({ file });
            handleChange(type, file_url);
            toast({ title: "Success", description: "Image uploaded successfully." });
        } catch (error) {
            console.error('Image upload failed:', error);
            toast({ title: "Upload Failed", description: "There was an error uploading your image.", variant: "destructive" });
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
        } catch (error) {
            console.error('Failed to update profile:', error);
            toast({ title: "Save Failed", description: "Could not save your settings. Please try again.", variant: "destructive" });
        }
        setIsSaving(false);
    };

    const handleExpertRequest = async () => {
        if (!expertRequestText.trim() || !user) return;

        setIsSubmittingRequest(true);
        try {
            const requestData = {
                user_email: user.email,
                user_name: user.full_name,
                experience_description: expertRequestText.trim(),
                status: 'pending'
            };

            const newRequest = await ExpertVerificationRequest.create(requestData);
            setExpertRequest(newRequest);
            setShowExpertRequestForm(false);
            setExpertRequestText('');
            toast({ title: "Request Submitted", description: "Your expert verification request has been sent for review." });
        } catch (error) {
            console.error('Failed to submit expert request:', error);
            toast({ title: "Submission Failed", description: "Could not submit your request.", variant: "destructive" });
        }
        setIsSubmittingRequest(false);
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

    return (
        <div className="bg-slate-950 min-h-screen p-4 md:p-8 text-slate-100">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                        <div className="w-12 h-12 bg-emerald-600/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
                            <Settings className="w-6 h-6 text-emerald-400" />
                        </div>
                        <h1 className="text-4xl font-bold text-slate-100">Account Settings</h1>
                    </div>
                    <p className="text-lg text-slate-400">Manage your profile, privacy settings, and account preferences.</p>
                </div>
                
                {/* All Cards will use the new theme */}
                <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-slate-100 flex items-center gap-2"><Award className="w-5 h-5 text-yellow-400" />Expert Verification</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {user.is_expert ? (
                             <div className="flex items-center gap-2 text-green-400"><CheckCircle /> You are a verified expert.</div>
                        ) : expertRequest ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    {expertRequest.status === 'pending' && <><Clock className="w-5 h-5 text-yellow-400" /><Badge className="bg-yellow-900/50 text-yellow-300 border-yellow-500/30">Request Pending</Badge></>}
                                    {expertRequest.status === 'approved' && <><CheckCircle className="w-5 h-5 text-green-400" /><Badge className="bg-green-900/50 text-green-300 border-green-500/30">Approved</Badge></>}
                                    {expertRequest.status === 'denied' && <><X className="w-5 h-5 text-red-400" /><Badge className="bg-red-900/50 text-red-300 border-red-500/30">Request Denied</Badge></>}
                                </div>
                                <div>
                                    <Label className="text-slate-300">Your Request:</Label>
                                    <p className="text-sm text-slate-400 bg-slate-800 p-3 rounded-lg mt-1">{expertRequest.experience_description}</p>
                                </div>
                                {expertRequest.admin_response && (
                                    <div>
                                        <Label className="text-slate-300">Admin Response:</Label>
                                        <p className="text-sm text-slate-400 bg-slate-800 p-3 rounded-lg mt-1">{expertRequest.admin_response}</p>
                                    </div>
                                )}
                                {(expertRequest.status === 'denied' || showExpertRequestForm) && (
                                     <div className="space-y-4 pt-4">
                                        <Textarea placeholder="Describe your experience..." value={expertRequestText} onChange={(e) => setExpertRequestText(e.target.value)} className="bg-slate-800 border-slate-600 text-slate-100 min-h-32" />
                                        <div className="flex gap-2">
                                            <Button onClick={handleExpertRequest} disabled={isSubmittingRequest} className="bg-emerald-600 hover:bg-emerald-700">{isSubmittingRequest ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Submitting...</> : 'Submit New Request'}</Button>
                                            {expertRequest.status === 'denied' && <Button variant="outline" onClick={() => setShowExpertRequestForm(false)}>Cancel</Button>}
                                        </div>
                                    </div>
                                )}
                                {expertRequest.status !== 'denied' && !showExpertRequestForm && <Button variant="link" onClick={() => setShowExpertRequestForm(true)}>Submit a new request</Button>}
                            </div>
                        ) : (
                             <div className="space-y-4">
                                 <p className="text-slate-400">Expert users can verify gecko classifications to improve the AI. Describe your experience to apply.</p>
                                 <Textarea placeholder="Describe your experience with crested gecko morphs, breeding history, years of experience, etc..." value={expertRequestText} onChange={(e) => setExpertRequestText(e.target.value)} className="bg-slate-800 border-slate-600 text-slate-100 min-h-32" />
                                 <Button onClick={handleExpertRequest} disabled={!expertRequestText.trim() || isSubmittingRequest} className="bg-emerald-600 hover:bg-emerald-700">{isSubmittingRequest ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Submitting...</> : 'Request Expert Verification'}</Button>
                             </div>
                        )}
                    </CardContent>
                </Card>

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
                
                <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm">
                    <CardHeader><CardTitle className="text-slate-100">Basic Information</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="breeder_name" className="text-slate-300">Breeder/Business Name</Label>
                                <Input id="breeder_name" value={formData.breeder_name} onChange={(e) => handleChange('breeder_name', e.target.value)} placeholder="Optional" className="bg-slate-800 border-slate-600 text-slate-100" />
                            </div>
                            <div>
                                <Label htmlFor="location" className="text-slate-300">Location</Label>
                                <Input id="location" value={formData.location} onChange={(e) => handleChange('location', e.target.value)} placeholder="City, State/Country" className="bg-slate-800 border-slate-600 text-slate-100" />
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
                            <div className="flex gap-2">
                                <Input value={newSpecialty} onChange={(e) => setNewSpecialty(e.target.value)} placeholder="Add a specialty..." onKeyPress={(e) => e.key === 'Enter' && addSpecialty()} className="bg-slate-800 border-slate-600 text-slate-100" />
                                <Button onClick={addSpecialty} type="button" className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /></Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {formData.specialties.map((specialty) => (
                                    <Badge key={specialty} variant="secondary" className="flex items-center gap-1 bg-slate-700 text-slate-200 border-slate-600">
                                        {specialty}
                                        <button onClick={() => removeSpecialty(specialty)}><X className="w-3 h-3" /></button>
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm">
                    <CardHeader><CardTitle className="text-slate-100 flex items-center gap-2"><Mail className="w-5 h-5"/>Contact Information</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div><Label htmlFor="email_contact" className="text-slate-300">Contact Email</Label><Input id="email_contact" value={formData.email_contact} onChange={(e) => handleChange('email_contact', e.target.value)} placeholder="your.email@example.com" className="bg-slate-800 border-slate-600 text-slate-100" /></div>
                        <div><Label htmlFor="phone_contact" className="text-slate-300">Phone Number</Label><Input id="phone_contact" value={formData.phone_contact} onChange={(e) => handleChange('phone_contact', e.target.value)} placeholder="(555) 123-4567" className="bg-slate-800 border-slate-600 text-slate-100" /></div>
                        <div><Label htmlFor="business_address" className="text-slate-300">Business Address</Label><Textarea id="business_address" value={formData.business_address} onChange={(e) => handleChange('business_address', e.target.value)} placeholder="123 Main St, City, State 12345" className="h-20 bg-slate-800 border-slate-600 text-slate-100" /></div>
                    </CardContent>
                </Card>

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

                <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm">
                    <CardHeader><CardTitle className="text-slate-100 flex items-center gap-2"><Eye className="w-5 h-5"/>Privacy Settings</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        {renderSwitch('profile-public', 'Make Profile Public', 'Allow others to view your profile and collection', formData.profile_public, (checked) => handleChange('profile_public', checked))}
                        {renderSwitch('show-username', 'Show Username on Images', 'Display your name on images you upload', formData.show_username_on_images, (checked) => handleChange('show_username_on_images', checked))}
                        {renderSwitch('allow-clicks', 'Allow Profile Clicks', 'Let others click your name to view your profile', formData.allow_profile_clicks, (checked) => handleChange('allow_profile_clicks', checked))}
                        {renderSwitch('palm-sync', 'Sync with PalmStreet', 'Allows PalmStreet users to find your public profile', formData.palm_street_sync_enabled, (checked) => handleChange('palm_street_sync_enabled', checked))}
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/50 border-slate-700 backdrop-blur-sm">
                    <CardHeader><CardTitle className="text-slate-100 flex items-center gap-2"><Mail className="w-5 h-5"/>Email Notifications</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        {renderSwitch('email-enabled', 'Enable Email Notifications', null, formData.email_notifications_enabled, (checked) => handleChange('email_notifications_enabled', checked))}
                        {formData.email_notifications_enabled && (
                            <div className="space-y-3">
                                {notificationTypes.map(notifType => renderNotificationSwitch(notifType, formData.email_notification_types.includes(notifType.key), () => toggleArrayItem('email_notification_types', notifType.key)))}
                            </div>
                        )}
                    </CardContent>
                </Card>

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

                <Button onClick={handleSave} disabled={isSaving} className="w-full bg-emerald-600 hover:bg-emerald-700 text-lg py-6">
                    {isSaving ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Saving...</> : <><Save className="w-5 h-5 mr-2" /> Save All Settings</>}
                </Button>
            </div>
        </div>
    );
}