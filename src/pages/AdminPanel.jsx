import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AnalyticsDashboard from '../components/admin/AnalyticsDashboard';
import ScrapedDataReview from '../components/admin/ScrapedDataReview';
import PageManagement from '../components/admin/PageManagement';
import MorphSubmissionReview from '../components/admin/MorphSubmissionReview';
import UserManagement from '../components/admin/UserManagement';
import MassMessaging from '../components/admin/MassMessaging';
import ChangeLogManager from '../components/admin/ChangeLogManager';
import { Database, BarChart2, Layout, CheckSquare, Users, Megaphone, Sparkles } from 'lucide-react';

export default function AdminPanel() {
    return (
        <div className="p-4 md:p-8 bg-slate-950 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-4xl font-bold text-slate-100 mb-6">Admin Panel</h1>
                <Tabs defaultValue="analytics" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 md:grid-cols-7 bg-slate-800 border border-slate-700 h-auto p-1">
                        <TabsTrigger value="analytics" className="data-[state=active]:bg-slate-700 flex items-center gap-2"><BarChart2 className="w-4 h-4"/> Analytics</TabsTrigger>
                        <TabsTrigger value="users" className="data-[state=active]:bg-slate-700 flex items-center gap-2"><Users className="w-4 h-4"/> Users</TabsTrigger>
                        <TabsTrigger value="messaging" className="data-[state=active]:bg-slate-700 flex items-center gap-2"><Megaphone className="w-4 h-4"/> Messaging</TabsTrigger>
                        <TabsTrigger value="changelog" className="data-[state=active]:bg-emerald-700 flex items-center gap-2"><Sparkles className="w-4 h-4"/> Changelog</TabsTrigger>
                        <TabsTrigger value="scraped_data" className="data-[state=active]:bg-slate-700 flex items-center gap-2"><Database className="w-4 h-4"/> Scraped Data</TabsTrigger>
                        <TabsTrigger value="pages" className="data-[state=active]:bg-slate-700 flex items-center gap-2"><Layout className="w-4 h-4"/> Pages</TabsTrigger>
                        <TabsTrigger value="morph_submissions" className="data-[state=active]:bg-slate-700 flex items-center gap-2"><CheckSquare className="w-4 h-4"/> Morph Submissions</TabsTrigger>
                    </TabsList>
                    <TabsContent value="analytics" className="mt-6">
                        <AnalyticsDashboard />
                    </TabsContent>
                    <TabsContent value="users" className="mt-6">
                        <UserManagement />
                    </TabsContent>
                    <TabsContent value="messaging" className="mt-6">
                        <MassMessaging />
                    </TabsContent>
                    <TabsContent value="changelog" className="mt-6">
                        <ChangeLogManager />
                    </TabsContent>
                    <TabsContent value="scraped_data" className="mt-6">
                        <ScrapedDataReview />
                    </TabsContent>
                    <TabsContent value="pages" className="mt-6">
                        <PageManagement />
                    </TabsContent>
                    <TabsContent value="morph_submissions" className="mt-6">
                        <MorphSubmissionReview />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}