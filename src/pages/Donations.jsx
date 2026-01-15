import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Heart, Coffee, Sparkles, DollarSign, Edit, Save, X, Loader2 } from 'lucide-react';
import { AppSettings, User } from '@/entities/all';

export default function DonationsPage() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [pageContent, setPageContent] = useState('');
    const [editContent, setEditContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    useEffect(() => {
        const loadContent = async () => {
            try {
                const currentUser = await User.me();
                setIsAdmin(currentUser?.role === 'admin');
                
                const settings = await AppSettings.filter({ setting_key: 'donations_page_content' });
                if (settings.length > 0) {
                    setPageContent(settings[0].setting_value || getDefaultContent());
                } else {
                    setPageContent(getDefaultContent());
                }
            } catch (error) {
                console.error("Failed to load content:", error);
                setPageContent(getDefaultContent());
            }
            setIsLoading(false);
        };
        loadContent();
    }, []);
    
    const getDefaultContent = () => {
        return `Geck Inspect is a passion project built to serve the crested gecko breeding community. Every feature you see—from AI-powered morph identification to lineage tracking and breeding management—has been developed with love and countless hours of work.

This platform is completely free to use, with no ads or data selling. If you find value in Geck Inspect and would like to support its continued development and hosting costs, any contribution is deeply appreciated.

Your support helps:
• Keep the servers running and data secure
• Develop new AI features and improve accuracy
• Add requested features from the community
• Maintain a fast, reliable experience for everyone

Thank you for being part of this community and helping make Geck Inspect possible!`;
    };
    
    const handleEdit = () => {
        setEditContent(pageContent);
        setIsEditing(true);
    };
    
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const existing = await AppSettings.filter({ setting_key: 'donations_page_content' });
            if (existing.length > 0) {
                await AppSettings.update(existing[0].id, { setting_value: editContent });
            } else {
                await AppSettings.create({
                    setting_key: 'donations_page_content',
                    setting_value: editContent,
                    description: 'Content for the donations/support page'
                });
            }
            setPageContent(editContent);
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to save content:", error);
        }
        setIsSaving(false);
    };
    
    const handleCancel = () => {
        setIsEditing(false);
        setEditContent('');
    };
    
    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center space-y-4">
                    <div className="flex justify-center items-center gap-4">
                        <div className="bg-gradient-to-br from-pink-500 to-rose-600 p-4 rounded-full shadow-2xl">
                            <Heart className="w-12 h-12 text-white" />
                        </div>
                        {isAdmin && !isEditing && (
                            <Button
                                onClick={handleEdit}
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Content
                            </Button>
                        )}
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white">Support Geck Inspect</h1>
                    
                    {isEditing ? (
                        <div className="space-y-4">
                            <Textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="min-h-[300px] bg-slate-800 border-slate-600 text-slate-100"
                            />
                            <div className="flex gap-2 justify-center">
                                <Button
                                    onClick={handleCancel}
                                    variant="outline"
                                    className="border-slate-600"
                                >
                                    <X className="w-4 h-4 mr-2" />
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                    Save Changes
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xl text-slate-300 max-w-2xl mx-auto whitespace-pre-line">
                            {pageContent}
                        </p>
                    )}
                </div>

                {!isEditing && (
                    <>
                        <Card className="bg-slate-900/80 backdrop-blur-sm border-slate-700">
                            <CardHeader>
                                <CardTitle className="text-center text-slate-100">Donation Options</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <Card className="text-center p-6 bg-slate-800 hover:shadow-xl transition-all border-slate-600">
                                        <Coffee className="w-12 h-12 mx-auto mb-4 text-amber-500" />
                                        <h3 className="text-xl font-semibold mb-2 text-slate-100">Buy a Coffee</h3>
                                        <p className="text-3xl font-bold text-emerald-400 mb-4">$5</p>
                                        <p className="text-sm text-slate-400 mb-6">A small thank you</p>
                                        <Button className="w-full bg-amber-600 hover:bg-amber-700">
                                            <DollarSign className="w-4 h-4 mr-2" />
                                            Donate $5
                                        </Button>
                                    </Card>

                                    <Card className="text-center p-6 bg-slate-800 hover:shadow-xl transition-all border-2 border-emerald-500">
                                        <Heart className="w-12 h-12 mx-auto mb-4 text-pink-500" />
                                        <h3 className="text-xl font-semibold mb-2 text-slate-100">Support Development</h3>
                                        <p className="text-3xl font-bold text-emerald-400 mb-4">$25</p>
                                        <p className="text-sm text-slate-400 mb-6">Fund features</p>
                                        <Button className="w-full bg-pink-600 hover:bg-pink-700">
                                            <DollarSign className="w-4 h-4 mr-2" />
                                            Donate $25
                                        </Button>
                                    </Card>

                                    <Card className="text-center p-6 bg-slate-800 hover:shadow-xl transition-all border-slate-600">
                                        <Sparkles className="w-12 h-12 mx-auto mb-4 text-purple-500" />
                                        <h3 className="text-xl font-semibold mb-2 text-slate-100">Champion</h3>
                                        <p className="text-3xl font-bold text-emerald-400 mb-4">$50</p>
                                        <p className="text-sm text-slate-400 mb-6">Major impact</p>
                                        <Button className="w-full bg-purple-600 hover:bg-purple-700">
                                            <DollarSign className="w-4 h-4 mr-2" />
                                            Donate $50
                                        </Button>
                                    </Card>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="text-center space-y-4">
                            <p className="text-slate-400 text-sm">
                                Thank you for being part of this community and helping make Geck Inspect possible! 🦎
                            </p>
                            <p className="text-slate-500 text-xs">
                                Geck Inspect is an independent project and not affiliated with any gecko breeding organization.
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}