import { useState } from 'react';
import { User } from '@/entities/User';
import { UploadFile } from '@/integrations/Core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Upload, 
  Save, 
  Globe,
  X,
  Plus,
  Mail,
  Shield
} from 'lucide-react';

export default function ProfileSettings({ user, onUserUpdate }) {
    const [formData, setFormData] = useState({
        bio: user?.bio || '',
        location: user?.location || '',
        profile_image_url: user?.profile_image_url || '',
        cover_image_url: user?.cover_image_url || '',
        is_public_profile: user?.is_public_profile !== false, // Default to true
        show_username_on_images: user?.show_username_on_images !== false, // Default to true
        allow_profile_clicks: user?.allow_profile_clicks !== false, // Default to true
        website_url: user?.website_url || '',
        instagram_handle: user?.instagram_handle || '',
        facebook_url: user?.facebook_url || '',
        youtube_url: user?.youtube_url || '',
        tiktok_handle: user?.tiktok_handle || '',
        palm_street_url: user?.palm_street_url || '', // New field
        morphmarket_url: user?.morphmarket_url || '', // New field
        breeder_name: user?.breeder_name || '',
        years_experience: user?.years_experience || '',
        specialties: user?.specialties || [],
        email_contact: user?.email_contact || '',
        phone_contact: user?.phone_contact || '',
        business_address: user?.business_address || '',
        email_notifications_enabled: user?.email_notifications_enabled !== false, // Default to true
        email_notification_types: user?.email_notification_types || ['level_up', 'expert_status', 'new_message', 'gecko_of_day', 'announcements'], // Default types
        calendar_alerts_enabled: user?.calendar_alerts_enabled !== false, // Default to true
        calendar_alert_types: user?.calendar_alert_types || ['egg_lay_estimate', 'hatch_estimate', 'breeding_reminders'], // Default types
        palm_street_sync_enabled: user?.palm_street_sync_enabled || false, // Default to false
        morphmarket_sync_enabled: user?.morphmarket_sync_enabled || false // New field, default to false
    });
    const [isSaving, setIsSaving] = useState(false);
    const [newSpecialty, setNewSpecialty] = useState('');

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleImageUpload = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const { file_url } = await UploadFile({ file });
            setFormData(prev => ({ ...prev, [type]: file_url }));
        } catch (error) {
            console.error('Image upload failed:', error);
        }
    };

    const addSpecialty = () => {
        if (newSpecialty.trim()) {
            setFormData(prev => ({
                ...prev,
                specialties: [...prev.specialties, newSpecialty.trim()]
            }));
            setNewSpecialty('');
        }
    };

    const removeSpecialty = (index) => {
        setFormData(prev => ({
            ...prev,
            specialties: prev.specialties.filter((_, i) => i !== index)
        }));
    };

    const toggleNotificationType = (type) => {
        setFormData(prev => ({
            ...prev,
            email_notification_types: prev.email_notification_types.includes(type)
                ? prev.email_notification_types.filter(t => t !== type)
                : [...prev.email_notification_types, type]
        }));
    };

    const toggleCalendarAlertType = (type) => {
        setFormData(prev => ({
            ...prev,
            calendar_alert_types: prev.calendar_alert_types.includes(type)
                ? prev.calendar_alert_types.filter(t => t !== type)
                : [...prev.calendar_alert_types, type]
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await User.updateMyUserData(formData);
            onUserUpdate({...user, ...formData});
        } catch (error) {
            console.error('Failed to update profile:', error);
        }
        setIsSaving(false);
    };

    const ToggleSwitch = ({ label, description, checked, onCheckedChange }) => (
        <div className="flex items-center justify-between p-4 border border-sage-200 rounded-lg">
            <div className="flex-1">
                <Label className="text-base font-medium">{label}</Label>
                {description && <p className="text-sm text-sage-600 mt-1">{description}</p>}
            </div>
            <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${checked ? 'text-green-600' : 'text-gray-500'}`}>
                    {checked ? 'Enabled' : 'Disabled'}
                </span>
                <Switch
                    checked={checked}
                    onCheckedChange={onCheckedChange}
                    className="data-[state=checked]:bg-green-500"
                />
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Profile Images */}
            <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
                <CardHeader>
                    <CardTitle>Profile Photos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Cover Photo */}
                    <div className="space-y-2">
                        <Label>Cover Photo</Label>
                        <div className="relative w-full h-32 bg-sage-100 rounded-lg overflow-hidden border border-sage-200">
                            {formData.cover_image_url ? (
                                <img src={formData.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-sage-400">
                                    <Upload className="w-8 h-8" />
                                </div>
                            )}
                            <Button asChild variant="outline" size="sm" className="absolute bottom-2 right-2">
                                <label className="cursor-pointer">
                                    <Upload className="w-4 h-4 mr-2" />
                                    Upload Cover
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'cover_image_url')} />
                                </label>
                            </Button>
                        </div>
                    </div>

                    {/* Profile Photo */}
                    <div className="space-y-2">
                        <Label>Profile Photo</Label>
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-20 rounded-full overflow-hidden border border-sage-200 bg-sage-100">
                                {formData.profile_image_url ? (
                                    <img src={formData.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-sage-400">
                                        <Upload className="w-6 h-6" />
                                    </div>
                                )}
                            </div>
                            <Button asChild variant="outline">
                                <label className="cursor-pointer">
                                    <Upload className="w-4 h-4 mr-2" />
                                    Upload Profile Photo
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'profile_image_url')} />
                                </label>
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Basic Profile Information */}
            <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        Basic Information
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="breeder_name">Breeder/Business Name</Label>
                            <Input
                                id="breeder_name"
                                value={formData.breeder_name}
                                onChange={(e) => handleChange('breeder_name', e.target.value)}
                                placeholder="Optional breeder name"
                            />
                        </div>
                        <div>
                            <Label htmlFor="location">Location</Label>
                            <Input
                                id="location"
                                value={formData.location}
                                onChange={(e) => handleChange('location', e.target.value)}
                                placeholder="City, State/Country"
                            />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea
                            id="bio"
                            value={formData.bio}
                            onChange={(e) => handleChange('bio', e.target.value)}
                            placeholder="Tell others about your gecko keeping experience..."
                            className="h-24"
                        />
                    </div>

                    <div>
                        <Label htmlFor="years_experience">Years of Experience</Label>
                        <Input
                            id="years_experience"
                            type="number"
                            value={formData.years_experience}
                            onChange={(e) => handleChange('years_experience', parseInt(e.target.value) || 0)}
                            placeholder="How many years keeping/breeding geckos?"
                        />
                    </div>

                    {/* Specialties */}
                    <div className="space-y-3">
                        <Label>Specialties/Morphs You Focus On</Label>
                        <div className="flex gap-2">
                            <Input
                                value={newSpecialty}
                                onChange={(e) => setNewSpecialty(e.target.value)}
                                placeholder="Add a specialty (e.g., Harlequins, Flames)"
                                onKeyPress={(e) => e.key === 'Enter' && addSpecialty()}
                            />
                            <Button onClick={addSpecialty} type="button">
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {formData.specialties.map((specialty, index) => (
                                <Badge key={index} variant="secondary" className="flex items-center gap-1 rounded-lg">
                                    {specialty}
                                    <button onClick={() => removeSpecialty(index)}>
                                        <X className="w-3 h-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {/* Contact Information */}
                    <div className="space-y-4">
                        <Label className="text-base font-semibold">Contact Information</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="email_contact">Contact Email</Label>
                                <Input
                                    id="email_contact"
                                    value={formData.email_contact}
                                    onChange={(e) => handleChange('email_contact', e.target.value)}
                                    placeholder="your.email@example.com"
                                />
                            </div>
                            <div>
                                <Label htmlFor="phone_contact">Phone Number</Label>
                                <Input
                                    id="phone_contact"
                                    value={formData.phone_contact}
                                    onChange={(e) => handleChange('phone_contact', e.target.value)}
                                    placeholder="(555) 123-4567"
                                />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="business_address">Business Address</Label>
                            <Textarea
                                id="business_address"
                                value={formData.business_address}
                                onChange={(e) => handleChange('business_address', e.target.value)}
                                placeholder="123 Main St, City, State 12345"
                                className="h-20"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Social Media & Website */}
            <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Globe className="w-5 h-5" />
                        Social Media & Marketplaces
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="website_url">Website URL</Label>
                            <Input
                                id="website_url"
                                value={formData.website_url}
                                onChange={(e) => handleChange('website_url', e.target.value)}
                                placeholder="https://yourwebsite.com (full URL)"
                            />
                        </div>
                        <div>
                            <Label htmlFor="instagram_handle">Instagram Handle</Label>
                            <Input
                                id="instagram_handle"
                                value={formData.instagram_handle}
                                onChange={(e) => handleChange('instagram_handle', e.target.value)}
                                placeholder="username (without @ symbol)"
                            />
                        </div>
                        <div>
                            <Label htmlFor="facebook_url">Facebook URL</Label>
                            <Input
                                id="facebook_url"
                                value={formData.facebook_url}
                                onChange={(e) => handleChange('facebook_url', e.target.value)}
                                placeholder="https://facebook.com/yourpage (full URL)"
                            />
                        </div>
                        <div>
                            <Label htmlFor="youtube_url">YouTube Channel</Label>
                            <Input
                                id="youtube_url"
                                value={formData.youtube_url}
                                onChange={(e) => handleChange('youtube_url', e.target.value)}
                                placeholder="https://youtube.com/yourchannel (full URL)"
                            />
                        </div>
                        <div>
                            <Label htmlFor="tiktok_handle">TikTok Handle</Label>
                            <Input
                                id="tiktok_handle"
                                value={formData.tiktok_handle}
                                onChange={(e) => handleChange('tiktok_handle', e.target.value)}
                                placeholder="username (without @ symbol)"
                            />
                        </div>
                        <div>
                            <Label htmlFor="palm_street_url">Palm Street Profile</Label>
                            <Input
                                id="palm_street_url"
                                value={formData.palm_street_url}
                                onChange={(e) => handleChange('palm_street_url', e.target.value)}
                                placeholder="https://palmstreet.com/yourprofile (full URL)"
                            />
                        </div>
                        <div>
                            <Label htmlFor="morphmarket_url">MorphMarket Store</Label>
                            <Input
                                id="morphmarket_url"
                                value={formData.morphmarket_url}
                                onChange={(e) => handleChange('morphmarket_url', e.target.value)}
                                placeholder="https://morphmarket.com/store/yourstore (full URL)"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Privacy Settings */}
            <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        Privacy & Platform Integrations
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <ToggleSwitch
                        label="Make Profile Public"
                        description="Allow others to view your profile and collection"
                        checked={formData.is_public_profile}
                        onCheckedChange={(checked) => handleChange('is_public_profile', checked)}
                    />
                    <ToggleSwitch
                        label="Show Username on Images"
                        description="Display your name on images you upload"
                        checked={formData.show_username_on_images}
                        onCheckedChange={(checked) => handleChange('show_username_on_images', checked)}
                    />
                    <ToggleSwitch
                        label="Allow Profile Clicks"
                        description="Let others click your name to view your profile"
                        checked={formData.allow_profile_clicks}
                        onCheckedChange={(checked) => handleChange('allow_profile_clicks', checked)}
                    />
                     <ToggleSwitch
                        label="Sync with MorphMarket"
                        description="Allows integration with your MorphMarket store."
                        checked={formData.morphmarket_sync_enabled}
                        onCheckedChange={(checked) => handleChange('morphmarket_sync_enabled', checked)}
                    />
                    <ToggleSwitch
                        label="Sync with Palm Street"
                        description="Allows PalmStreet users to find your public profile and breeding projects by your username or email."
                        checked={formData.palm_street_sync_enabled}
                        onCheckedChange={(checked) => handleChange('palm_street_sync_enabled', checked)}
                    />
                </CardContent>
            </Card>

            {/* Email Notification Settings */}
            <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mail className="w-5 h-5" />
                        Email Notifications
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <ToggleSwitch
                        label="Receive Email Notifications"
                        description="Get important updates sent to your email"
                        checked={formData.email_notifications_enabled}
                        onCheckedChange={(checked) => handleChange('email_notifications_enabled', checked)}
                    />

                    {formData.email_notifications_enabled && (
                        <div className="space-y-4">
                            <div>
                                <Label className="text-base font-medium">Notification Types</Label>
                                <p className="text-sm text-sage-600 mb-3">Choose which notifications you want to receive via email</p>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    { key: 'level_up', label: 'Level Up & Achievements', description: 'When you earn new badges or reach milestones' },
                                    { key: 'expert_status', label: 'Expert Status Updates', description: 'Changes to your expert verification status' },
                                    { key: 'new_message', label: 'New Messages', description: 'When you receive direct messages from other users' },
                                    { key: 'gecko_of_day', label: 'Gecko of the Day', description: 'When your gecko photo is selected as featured' },
                                    { key: 'forum_replies', label: 'Forum Activity', description: 'Replies to your forum posts and comments' },
                                    { key: 'breeding_updates', label: 'Breeding Updates', description: 'Updates about your breeding plans and outcomes' },
                                    { key: 'announcements', label: 'Platform Announcements', description: 'Important news and feature updates' }
                                ].map(notifType => (
                                    <div key={notifType.key} className="flex items-start justify-between p-3 border border-sage-200 rounded-lg">
                                        <div className="flex-1">
                                            <Label className="font-medium">{notifType.label}</Label>
                                            <p className="text-sm text-sage-600 mt-1">{notifType.description}</p>
                                        </div>
                                        <div className="flex items-center gap-3 ml-4">
                                            <span className={`text-xs font-medium ${formData.email_notification_types.includes(notifType.key) ? 'text-green-600' : 'text-gray-500'}`}>
                                                {formData.email_notification_types.includes(notifType.key) ? 'Enabled' : 'Disabled'}
                                            </span>
                                            <Switch
                                                checked={formData.email_notification_types.includes(notifType.key)}
                                                onCheckedChange={() => toggleNotificationType(notifType.key)}
                                                className="data-[state=checked]:bg-green-500"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Calendar Alert Settings */}
            <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mail className="w-5 h-5" /> {/* Reusing Mail icon for calendar alerts, or change to Calendar icon if available */}
                        Calendar Alerts
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <ToggleSwitch
                        label="Receive Calendar Alerts"
                        description="Get notifications for breeding projects and important dates"
                        checked={formData.calendar_alerts_enabled}
                        onCheckedChange={(checked) => handleChange('calendar_alerts_enabled', checked)}
                    />

                    {formData.calendar_alerts_enabled && (
                        <div className="space-y-4">
                            <div>
                                <Label className="text-base font-medium">Alert Types</Label>
                                <p className="text-sm text-sage-600 mb-3">Choose which calendar alerts you want to receive</p>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    { key: 'egg_lay_estimate', label: 'Egg Lay Estimates', description: 'Reminders for anticipated egg laying dates' },
                                    { key: 'hatch_estimate', label: 'Hatch Estimates', description: 'Reminders for anticipated hatch dates' },
                                    { key: 'breeding_reminders', label: 'Breeding Reminders', description: 'Alerts for planned breeding pairings' },
                                ].map(alertType => (
                                    <div key={alertType.key} className="flex items-start justify-between p-3 border border-sage-200 rounded-lg">
                                        <div className="flex-1">
                                            <Label className="font-medium">{alertType.label}</Label>
                                            <p className="text-sm text-sage-600 mt-1">{alertType.description}</p>
                                        </div>
                                        <div className="flex items-center gap-3 ml-4">
                                            <span className={`text-xs font-medium ${formData.calendar_alert_types.includes(alertType.key) ? 'text-green-600' : 'text-gray-500'}`}>
                                                {formData.calendar_alert_types.includes(alertType.key) ? 'Enabled' : 'Disabled'}
                                            </span>
                                            <Switch
                                                checked={formData.calendar_alert_types.includes(alertType.key)}
                                                onCheckedChange={() => toggleCalendarAlertType(alertType.key)}
                                                className="data-[state=checked]:bg-green-500"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Button onClick={handleSave} disabled={isSaving} className="w-full bg-gradient-to-r from-sage-600 to-earth-600 hover:from-sage-700 hover:to-earth-700">
                {isSaving ? (
                    'Saving...'
                ) : (
                    <>
                        <Save className="w-4 h-4 mr-2" />
                        Save All Settings
                    </>
                )}
            </Button>
        </div>
    );
}