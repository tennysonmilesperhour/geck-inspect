import React, { useState, useEffect } from 'react';
import { User, GeckoImage, ForumPost, ForumComment, UserActivity, Gecko } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { Users, Image as ImageIcon, MessageSquare, Loader2, TrendingUp, Calendar, Award, GitBranch } from 'lucide-react';
import groupBy from 'lodash/groupBy';
import countBy from 'lodash/countBy';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d0ed57', '#a4de6c', '#d8b4fe'];
const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12}>
      {`${name} (${(percent * 100).toFixed(0)}%)`}
    </text>
  );
};


export default function AnalyticsDashboard() {
    const [stats, setStats] = useState({
        userCount: 0,
        imageCount: 0,
        postCount: 0,
        commentCount: 0,
        expertCount: 0,
        adminCount: 0
    });
    const [timeSeriesData, setTimeSeriesData] = useState([]);
    const [topContributors, setTopContributors] = useState([]);
    const [morphDistribution, setMorphDistribution] = useState([]);
    const [userGrowthData, setUserGrowthData] = useState([]);
    const [userRoleData, setUserRoleData] = useState([]);
    const [geckoStatusData, setGeckoStatusData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAnalyticsData = async () => {
            setIsLoading(true);
            try {
                const [allUsers, allImages, allPosts, allComments, allGeckos] = await Promise.all([
                    User.list(),
                    GeckoImage.list(),
                    ForumPost.list().catch(() => []),
                    ForumComment.list().catch(() => []),
                    Gecko.list().catch(() => [])
                ]);

                // Basic Stats & User Role Data
                const userCounts = countBy(allUsers, 'role');
                const expertCount = allUsers.filter(u => u.is_expert).length;
                setStats({
                    userCount: allUsers.length,
                    imageCount: allImages.length,
                    postCount: allPosts.length,
                    commentCount: allComments.length,
                    expertCount: expertCount,
                    adminCount: userCounts.admin || 0
                });
                 setUserRoleData([
                    { name: 'User', value: userCounts.user || 0 },
                    { name: 'Admin', value: userCounts.admin || 0 },
                    { name: 'Expert', value: expertCount }
                ]);
                
                // Gecko Status Data
                const geckoStatusCounts = countBy(allGeckos, 'status');
                const geckoData = Object.entries(geckoStatusCounts).map(([name, value]) => ({name, value}));
                setGeckoStatusData(geckoData);

                // Time Series Data (last 30 days)
                const today = startOfDay(new Date());
                const dateRange = Array.from({ length: 30 }, (_, i) => subDays(today, i)).reverse();
                const usersByDate = groupBy(allUsers, u => format(startOfDay(new Date(u.created_date)), 'yyyy-MM-dd'));
                const imagesByDate = groupBy(allImages, i => format(startOfDay(new Date(i.created_date)), 'yyyy-MM-dd'));
                const postsByDate = groupBy(allPosts, p => format(startOfDay(new Date(p.created_date)), 'yyyy-MM-dd'));
                const chartData = dateRange.map(date => {
                    const dateString = format(date, 'yyyy-MM-dd');
                    const dayMonthString = format(date, 'MMM d');
                    return {
                        name: dayMonthString,
                        Users: (usersByDate[dateString] || []).length,
                        Images: (imagesByDate[dateString] || []).length,
                        Posts: (postsByDate[dateString] || []).length
                    };
                });
                setTimeSeriesData(chartData);

                // User Growth (cumulative)
                const userGrowth = dateRange.map((date, index) => {
                    const usersUpToDate = allUsers.filter(u => new Date(u.created_date) <= date).length;
                    return { name: format(date, 'MMM d'), 'Total Users': usersUpToDate };
                });
                setUserGrowthData(userGrowth);

                // Top Contributors
                const contributions = {};
                allPosts.forEach(p => { contributions[p.created_by] = (contributions[p.created_by] || 0) + 2; });
                allComments.forEach(c => { contributions[c.created_by] = (contributions[c.created_by] || 0) + 1; });
                allImages.forEach(i => { contributions[i.created_by] = (contributions[i.created_by] || 0) + 1; });
                const contributors = Object.entries(contributions)
                    .map(([email, score]) => {
                        const user = allUsers.find(u => u.email === email);
                        return { name: user ? (user.full_name || user.email.split('@')[0]) : email.split('@')[0], email, score };
                    })
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 10);
                setTopContributors(contributors);

                // Morph Distribution
                const morphCounts = countBy(allImages.filter(i => i.primary_morph), 'primary_morph');
                const morphData = Object.entries(morphCounts)
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 8);
                setMorphDistribution(morphData);

            } catch (error) {
                console.error("Failed to load analytics data:", error);
            }
            setIsLoading(false);
        };
        fetchAnalyticsData();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                <span className="ml-4 text-slate-400">Loading comprehensive analytics...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="bg-slate-800 border-slate-600"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-slate-300">Total Users</CardTitle><Users className="h-4 w-4 text-slate-400" /></CardHeader><CardContent><div className="text-2xl font-bold text-white">{stats.userCount}</div><p className="text-xs text-slate-400">Registered accounts</p></CardContent></Card>
                <Card className="bg-slate-800 border-slate-600"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-slate-300">Training Images</CardTitle><ImageIcon className="h-4 w-4 text-slate-400" /></CardHeader><CardContent><div className="text-2xl font-bold text-white">{stats.imageCount}</div><p className="text-xs text-slate-400">AI dataset size</p></CardContent></Card>
                <Card className="bg-slate-800 border-slate-600"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-slate-300">Expert Users</CardTitle><Award className="h-4 w-4 text-slate-400" /></CardHeader><CardContent><div className="text-2xl font-bold text-blue-400">{stats.expertCount}</div><p className="text-xs text-slate-400">Verified experts</p></CardContent></Card>
                <Card className="bg-slate-800 border-slate-600"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-slate-300">Forum Posts</CardTitle><MessageSquare className="h-4 w-4 text-slate-400" /></CardHeader><CardContent><div className="text-2xl font-bold text-white">{stats.postCount}</div><p className="text-xs text-slate-400">Community discussions</p></CardContent></Card>
                <Card className="bg-slate-800 border-slate-600"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-slate-300">Forum Comments</CardTitle><MessageSquare className="h-4 w-4 text-slate-400" /></CardHeader><CardContent><div className="text-2xl font-bold text-white">{stats.commentCount}</div><p className="text-xs text-slate-400">Community engagement</p></CardContent></Card>
                <Card className="bg-slate-800 border-slate-600"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-slate-300">Administrators</CardTitle><Users className="h-4 w-4 text-slate-400" /></CardHeader><CardContent><div className="text-2xl font-bold text-purple-400">{stats.adminCount}</div><p className="text-xs text-slate-400">System admins</p></CardContent></Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-slate-900 border-slate-700"><CardHeader><CardTitle className="text-white flex items-center gap-2"><Calendar className="w-5 h-5" /> Daily Activity (Last 30 Days)</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={timeSeriesData}><CartesianGrid strokeDasharray="3 3" stroke="#475569" /><XAxis dataKey="name" stroke="#94a3b8" fontSize={12} /><YAxis stroke="#94a3b8" fontSize={12} /><Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }} /><Legend /><Bar dataKey="Images" fill="#8884d8" name="New Images" /><Bar dataKey="Posts" fill="#82ca9d" name="New Posts" /><Bar dataKey="Users" fill="#ffc658" name="New Users" /></BarChart></ResponsiveContainer></CardContent></Card>
                <Card className="bg-slate-900 border-slate-700"><CardHeader><CardTitle className="text-white flex items-center gap-2"><TrendingUp className="w-5 h-5" /> User Growth Trend</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><LineChart data={userGrowthData}><CartesianGrid strokeDasharray="3 3" stroke="#475569" /><XAxis dataKey="name" stroke="#94a3b8" fontSize={12} /><YAxis stroke="#94a3b8" fontSize={12} /><Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }} /><Legend /><Line type="monotone" dataKey="Total Users" stroke="#ff7300" strokeWidth={3} dot={{ fill: '#ff7300', strokeWidth: 2, r: 4 }} /></LineChart></ResponsiveContainer></CardContent></Card>
                
                <Card className="bg-slate-900 border-slate-700"><CardHeader><CardTitle className="text-white">Top Morph Classifications</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={morphDistribution} cx="50%" cy="50%" labelLine={false} label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="value">{morphDistribution.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }} /></PieChart></ResponsiveContainer></CardContent></Card>
                <Card className="bg-slate-900 border-slate-700"><CardHeader><CardTitle className="text-white flex items-center gap-2"><Award className="w-5 h-5" /> Top Community Contributors</CardTitle></CardHeader><CardContent><div className="space-y-3">{topContributors.map((contributor, index) => (<div key={contributor.email} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-sm font-bold text-slate-300">{index + 1}</div><div><p className="font-medium text-white text-sm">{contributor.name}</p><p className="text-xs text-slate-400">{contributor.email}</p></div></div><div className="text-right"><p className="text-lg font-bold text-white">{contributor.score}</p><p className="text-xs text-slate-400">points</p></div></div>))}</div></CardContent></Card>
                
                <Card className="bg-slate-900 border-slate-700"><CardHeader><CardTitle className="text-white flex items-center gap-2"><Users className="w-5 h-5" /> User Role Distribution</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={userRoleData} cx="50%" cy="50%" labelLine={false} label={renderCustomizedLabel} outerRadius={100} fill="#8884d8" dataKey="value">{userRoleData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }} /></PieChart></ResponsiveContainer></CardContent></Card>
                <Card className="bg-slate-900 border-slate-700"><CardHeader><CardTitle className="text-white flex items-center gap-2"><GitBranch className="w-5 h-5" /> Gecko Status Distribution</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={geckoStatusData} cx="50%" cy="50%" labelLine={false} label={renderCustomizedLabel} outerRadius={100} fill="#8884d8" dataKey="value">{geckoStatusData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }} /></PieChart></ResponsiveContainer></CardContent></Card>
            </div>
        </div>
    );
}