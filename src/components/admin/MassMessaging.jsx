import React, { useState } from 'react';
import { User, DirectMessage, Notification } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from "@/components/ui/use-toast";
import { 
    Send, Users as UsersIcon, Shield, Award, Loader2, Sparkles, 
    Megaphone, Mail, MessageSquare, Bell
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InvokeLLM } from '@/integrations/Core';

const TARGET_GROUPS = [
    { value: 'all', label: 'All Users', icon: <UsersIcon className="w-4 h-4" />, color: 'bg-blue-600' },
    { value: 'experts', label: 'Experts Only', icon: <Award className="w-4 h-4" />, color: 'bg-green-600' },
    { value: 'admins', label: 'Admins Only', icon: <Shield className="w-4 h-4" />, color: 'bg-purple-600' },
    { value: 'non_experts', label: 'Regular Users', icon: <UsersIcon className="w-4 h-4" />, color: 'bg-gray-600' },
];

export default function MassMessaging() {
    const [targetGroup, setTargetGroup] = useState('all');
    const [subject, setSubject] = useState('');
    const [content, setContent] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const { toast } = useToast();

    const generateUpdateAnnouncement = async () => {
        setIsGenerating(true);
        try {
            // Real changelog of recent features implemented
            const recentChanges = `
Recent platform updates that were actually implemented:

1. MARKETPLACE LIKES - Users can now like/favorite geckos in the marketplace and view them in a dedicated "Liked Geckos" gallery accessible from the sidebar.

2. PUBLIC PROFILES ENHANCED - User profiles now display geckos organized into three tabs: "For Sale", "Breeders" (separated by male/female), and "Collection".

3. SOCIAL MEDIA BUTTONS - Profile pages now show social media links as icon buttons (Instagram, Facebook, YouTube, TikTok, Website) instead of text links.

4. COMMUNITY CONNECT IMPROVEMENTS - Breeder directory now prioritizes users with geckos for sale, then those with active breeding projects. Profile pictures are now square throughout the app.

5. FOLLOW SYSTEM - Users can follow breeders to stay updated on their activity. Following persists across sessions and syncs between profile and community pages.

6. NOTIFICATION IMPROVEMENTS - Toast notifications now disappear after 2 seconds with a smoother experience.
`;

            const prompt = `Generate a professional platform update announcement for "Geck Inspect" users based on these REAL changes that were actually implemented:

${recentChanges}

Create a user-friendly announcement that:
- Is professional but friendly in tone
- Lists ONLY the features mentioned above as bullet points
- Does NOT make up any features that aren't listed
- Thanks the community briefly
- Keeps it concise (under 300 words)
- Focuses on how these features benefit users

Format as a subject line and body content with bullet points for the features.`;

            const response = await InvokeLLM({
                prompt,
                response_json_schema: {
                    type: "object",
                    properties: {
                        subject: { type: "string" },
                        content: { type: "string" }
                    }
                }
            });

            setSubject(response.subject);
            setContent(response.content);
            toast({ title: "Success", description: "Update announcement generated!" });
        } catch (error) {
            console.error("Failed to generate announcement:", error);
            toast({ title: "Error", description: "Failed to generate announcement.", variant: "destructive" });
        }
        setIsGenerating(false);
    };

    const handleSend = async () => {
        if (!targetGroup || !subject.trim() || !content.trim()) {
            toast({ title: "Error", description: "Please fill in all fields.", variant: "destructive" });
            return;
        }

        setIsSending(true);
        try {
            // Get current admin user
            const currentAdmin = await base44.auth.me();
            
            // Fetch all users
            const allUsers = await User.list();
            
            // Filter users based on target group
            let targetUsers = [];
            switch (targetGroup) {
                case 'all':
                    targetUsers = allUsers;
                    break;
                case 'experts':
                    targetUsers = allUsers.filter(u => u.is_expert === true);
                    break;
                case 'admins':
                    targetUsers = allUsers.filter(u => u.role === 'admin');
                    break;
                case 'non_experts':
                    targetUsers = allUsers.filter(u => !u.is_expert);
                    break;
            }

            // Send messages and notifications to each user
            let sentCount = 0;
            for (const user of targetUsers) {
                try {
                    // Create direct message using current admin's email
                    await DirectMessage.create({
                        sender_email: currentAdmin.email,
                        recipient_email: user.email,
                        content: `**${subject}**\n\n${content}`,
                        message_type: 'system'
                    });

                    // Create notification
                    await Notification.create({
                        user_email: user.email,
                        type: 'announcement',
                        content: subject,
                        link: '/Messages',
                        metadata: { is_mass_message: true }
                    });

                    sentCount++;
                } catch (error) {
                    console.error(`Failed to send to ${user.email}:`, error);
                }
            }

            toast({ 
                title: "Success!", 
                description: `Message sent to ${sentCount} users.` 
            });

            // Clear form
            setSubject('');
            setContent('');
        } catch (error) {
            console.error("Failed to send mass message:", error);
            toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
        }
        setIsSending(false);
    };

    const selectedGroupInfo = TARGET_GROUPS.find(g => g.value === targetGroup);

    return (
        <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                    <Megaphone className="w-5 h-5" />
                    Mass Messaging & Announcements
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Target Group Selection */}
                <div className="space-y-3">
                    <Label className="text-slate-200">Target Audience</Label>
                    <Select value={targetGroup} onValueChange={setTargetGroup}>
                        <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                            <SelectValue placeholder="Select target group" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600">
                            {TARGET_GROUPS.map(group => (
                                <SelectItem key={group.value} value={group.value}>
                                    <div className="flex items-center gap-2">
                                        {group.icon}
                                        <span>{group.label}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedGroupInfo && (
                        <Badge className={`${selectedGroupInfo.color} text-white flex items-center gap-1 w-fit`}>
                            {selectedGroupInfo.icon}
                            Sending to: {selectedGroupInfo.label}
                        </Badge>
                    )}
                </div>

                {/* AI Generation */}
                <div className="p-4 bg-slate-800 rounded-lg border border-slate-600">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-yellow-400" />
                            AI Update Generator
                        </h3>
                        <Button
                            onClick={generateUpdateAnnouncement}
                            disabled={isGenerating}
                            variant="outline"
                            size="sm"
                            className="border-slate-600 hover:bg-slate-700"
                        >
                            {isGenerating ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                            ) : (
                                <><Sparkles className="w-4 h-4 mr-2" />Generate Update</>
                            )}
                        </Button>
                    </div>
                    <p className="text-sm text-slate-400">
                        Automatically generate a professional platform update announcement highlighting recent improvements and new features.
                    </p>
                </div>

                {/* Message Form */}
                <div className="space-y-4">
                    <div>
                        <Label className="text-slate-200">Subject Line</Label>
                        <Input
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="e.g., New Features & Improvements - Geck Inspect Update"
                            className="bg-slate-800 border-slate-600 text-slate-100 mt-1"
                        />
                    </div>

                    <div>
                        <Label className="text-slate-200">Message Content</Label>
                        <Textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Write your announcement here... Be sure to mention any new features, improvements, or important information for your users."
                            className="bg-slate-800 border-slate-600 text-slate-100 min-h-48 mt-1"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            Messages will appear in users' direct messages and they'll receive notifications.
                        </p>
                    </div>
                </div>

                {/* Preview */}
                {(subject || content) && (
                    <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-600">
                        <h4 className="font-semibold text-slate-200 mb-2">Preview:</h4>
                        {subject && <p className="font-bold text-slate-100 mb-2">Subject: {subject}</p>}
                        {content && <div className="text-slate-300 whitespace-pre-wrap">{content}</div>}
                    </div>
                )}

                {/* Send Button */}
                <div className="flex justify-end pt-4 border-t border-slate-600">
                    <Button
                        onClick={handleSend}
                        disabled={isSending || !subject.trim() || !content.trim()}
                        className="bg-emerald-600 hover:bg-emerald-700"
                        size="lg"
                    >
                        {isSending ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send className="w-5 h-5 mr-2" />
                                Send Mass Message
                            </>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}