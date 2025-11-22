
import React, { useState, useEffect } from 'react';
import { Gecko, User } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, subMonths } from 'date-fns';
import {
  DollarSign,
  Eye,
  TrendingUp,
  ShoppingCart,
  Calendar,
  ExternalLink,
  Edit,
  MessageCircle,
  HelpCircle // Added HelpCircle icon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'; // Added Shadcn Tooltip components


const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6', '#ec4899'];

export default function MyListingsPage() {
    const [user, setUser] = useState(null);
    const [geckos, setGeckos] = useState([]);
    const [analytics, setAnalytics] = useState({
        totalListings: 0,
        totalValue: 0,
        sold: 0,
        active: 0,
        views: 0, // Mock data removed
        messages: 0 // Mock data removed
    });
    const [salesData, setSalesData] = useState([]); // Added state for sales data
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const currentUser = await User.me();
                setUser(currentUser);

                const userGeckos = await Gecko.filter({ created_by: currentUser.email }, '-created_date');
                const marketplaceGeckos = userGeckos.filter(g => g.status === 'For Sale' || g.status === 'Sold');
                setGeckos(marketplaceGeckos);

                // Calculate analytics with real data
                const totalValue = marketplaceGeckos.reduce((sum, g) => sum + (g.asking_price || 0), 0);
                const soldGeckosFromFetch = marketplaceGeckos.filter(g => g.status === 'Sold'); // Renamed to avoid conflict with outer scope
                const active = marketplaceGeckos.filter(g => g.status === 'For Sale').length;

                setAnalytics({
                    totalListings: marketplaceGeckos.length,
                    totalValue,
                    sold: soldGeckosFromFetch.length, // Use length of filtered sold geckos
                    active,
                    views: 0, // Removed mock data, future feature
                    messages: 0 // Removed mock data, future feature
                });
                
                // Generate real sales data for the chart
                const monthlySales = {};
                for (let i = 5; i >= 0; i--) {
                    const date = subMonths(new Date(), i);
                    const monthKey = format(date, 'MMM');
                    monthlySales[monthKey] = { sales: 0, revenue: 0 };
                }

                soldGeckosFromFetch.forEach(gecko => {
                    if (gecko.updated_date) {
                        const saleDate = new Date(gecko.updated_date);
                        if (!isNaN(saleDate.getTime())) { // Ensure date is valid
                            const monthKey = format(saleDate, 'MMM');
                            if (monthlySales[monthKey]) {
                                monthlySales[monthKey].sales += 1;
                                monthlySales[monthKey].revenue += gecko.asking_price || 0;
                            }
                        }
                    }
                });

                const chartData = Object.keys(monthlySales).map(month => ({
                    month,
                    ...monthlySales[month]
                }));
                setSalesData(chartData);

            } catch (error) {
                console.error('Failed to load listings:', error);
            }
            setIsLoading(false);
        };

        loadData();
    }, []);

    const activeListings = geckos.filter(g => g.status === 'For Sale');
    const soldGeckos = geckos.filter(g => g.status === 'Sold');
    
    // Calculate morph distribution from real geckos data
    const morphDistribution = geckos.reduce((acc, gecko) => {
        if (gecko.morphs_traits) {
            const mainMorph = gecko.morphs_traits.split(' ')[0];
            acc[mainMorph] = (acc[mainMorph] || 0) + 1;
        }
        return acc;
    }, {});

    const pieData = Object.entries(morphDistribution).map(([morph, count]) => ({
        name: morph,
        value: count
    }));

    const GeckoListingCard = ({ gecko }) => {
        const primaryImage = gecko.image_urls && gecko.image_urls.length > 0 ? gecko.image_urls[0] : null;

        return (
            <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
                <div className="relative">
                    {primaryImage ? (
                        <img 
                            src={primaryImage} 
                            alt={gecko.name}
                            className="w-full h-32 object-cover rounded-t-lg"
                        />
                    ) : (
                        <div className="w-full h-32 bg-gradient-to-br from-sage-100 to-earth-100 flex items-center justify-center">
                            <ShoppingCart className="w-8 h-8 text-sage-400" />
                        </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-2">
                        <Badge className={`text-xs ${
                            gecko.status === 'For Sale' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                        }`}>
                            {gecko.status}
                        </Badge>
                        {gecko.asking_price && (
                            <Badge className="bg-blue-100 text-blue-800 text-xs">
                                ${gecko.asking_price}
                            </Badge>
                        )}
                    </div>
                </div>

                <CardContent className="p-4">
                    <div className="space-y-3">
                        <div>
                            <h3 className="font-bold text-sage-900">{gecko.name}</h3>
                            {gecko.morphs_traits && (
                                <p className="text-sm text-sage-600">{gecko.morphs_traits}</p>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-sm text-sage-600">
                            <span className={`px-2 py-1 rounded text-xs ${
                                gecko.sex === 'Male' ? 'bg-blue-100 text-blue-700' : 
                                gecko.sex === 'Female' ? 'bg-pink-100 text-pink-700' : 
                                'bg-gray-100 text-gray-700'
                            }`}>
                                {gecko.sex}
                            </span>
                            {/* Removed mock view count */}
                        </div>

                        {/* External Platform Links */}
                        {(gecko.morphmarket_url || gecko.palm_street_url) && (
                            <div className="flex gap-2">
                                {gecko.morphmarket_url && (
                                    <a 
                                        href={gecko.morphmarket_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex-1"
                                    >
                                        <Button size="sm" variant="outline" className="w-full text-xs">
                                            <ExternalLink className="w-3 h-3 mr-1" />
                                            MorphMarket
                                        </Button>
                                    </a>
                                )}
                                {gecko.palm_street_url && (
                                    <a 
                                        href={gecko.palm_street_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex-1"
                                    >
                                        <Button size="sm" variant="outline" className="w-full text-xs">
                                            <ExternalLink className="w-3 h-3 mr-1" />
                                            Palm Street
                                        </Button>
                                    </a>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2 pt-2">
                            <Link to={createPageUrl('MarketplaceSell')} className="flex-1">
                                <Button variant="outline" size="sm" className="w-full">
                                    <Edit className="w-3 h-3 mr-1" />
                                    Edit
                                </Button>
                            </Link>
                            <Link to={createPageUrl(`GeckoDetail?id=${gecko.id}`)} className="flex-1">
                                <Button variant="outline" size="sm" className="w-full">
                                    <Eye className="w-3 h-3 mr-1" />
                                    View
                                </Button>
                            </Link>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-sage-50 to-earth-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-sage-900 mb-2">My Listings</h1>
                    <p className="text-sage-600">Track your gecko sales and marketplace performance</p>
                </div>

                {/* Analytics Overview */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                    <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
                        <CardContent className="p-4 text-center">
                            <ShoppingCart className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-sage-900">{analytics.totalListings}</div>
                            <div className="text-xs text-sage-600">Total Listings</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
                        <CardContent className="p-4 text-center">
                            <DollarSign className="w-6 h-6 text-green-600 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-sage-900">${analytics.totalValue}</div>
                            <div className="text-xs text-sage-600">Total Value</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
                        <CardContent className="p-4 text-center">
                            <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-sage-900">{analytics.sold}</div>
                            <div className="text-xs text-sage-600">Sold</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
                        <CardContent className="p-4 text-center">
                            <Calendar className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-sage-900">{analytics.active}</div>
                            <div className="text-xs text-sage-600">Active</div>
                        </CardContent>
                    </Card>

                    <TooltipProvider>
                        <UITooltip>
                            <TooltipTrigger asChild>
                                <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
                                    <CardContent className="p-4 text-center">
                                        <Eye className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                                        <div className="text-2xl font-bold text-sage-900">{analytics.views}</div>
                                        <div className="text-xs text-sage-600 flex items-center justify-center gap-1">
                                            Total Views <HelpCircle className="w-3 h-3"/>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Feature coming soon!</p>
                            </TooltipContent>
                        </UITooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <UITooltip>
                            <TooltipTrigger asChild>
                                <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
                                    <CardContent className="p-4 text-center">
                                        <MessageCircle className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                                        <div className="text-2xl font-bold text-sage-900">{analytics.messages}</div>
                                        <div className="text-xs text-sage-600 flex items-center justify-center gap-1">
                                            Inquiries <HelpCircle className="w-3 h-3"/>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Feature coming soon!</p>
                            </TooltipContent>
                        </UITooltip>
                    </TooltipProvider>
                </div>

                <Tabs defaultValue="active" className="space-y-8">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="active">Active Listings ({activeListings.length})</TabsTrigger>
                        <TabsTrigger value="sold">Sold ({soldGeckos.length})</TabsTrigger>
                        <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    </TabsList>

                    {/* Active Listings */}
                    <TabsContent value="active">
                        {activeListings.length === 0 ? (
                            <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
                                <CardContent className="p-8 text-center">
                                    <ShoppingCart className="w-12 h-12 text-sage-400 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-sage-900 mb-2">No active listings</h3>
                                    <p className="text-sage-600 mb-4">Start selling by creating your first listing</p>
                                    <Link to={createPageUrl('MarketplaceSell')}>
                                        <Button>
                                            Create Listing
                                        </Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {activeListings.map(gecko => (
                                    <GeckoListingCard key={gecko.id} gecko={gecko} />
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* Sold Listings */}
                    <TabsContent value="sold">
                        {soldGeckos.length === 0 ? (
                            <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
                                <CardContent className="p-8 text-center">
                                    <TrendingUp className="w-12 h-12 text-sage-400 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-sage-900 mb-2">No sales yet</h3>
                                    <p className="text-sage-600">Your sold geckos will appear here</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {soldGeckos.map(gecko => (
                                    <GeckoListingCard key={gecko.id} gecko={gecko} />
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* Analytics */}
                    <TabsContent value="analytics">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
                                <CardHeader>
                                    <CardTitle>Sales Over Time (Last 6 Months)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={salesData}> {/* Using real salesData from state */}
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="month" />
                                            <YAxis />
                                            <Tooltip formatter={(value, name) => name === 'revenue' ? `$${value}`: value} />
                                            <Legend /> {/* Added Legend component */}
                                            <Bar dataKey="sales" fill="#10b981" />
                                            <Bar dataKey="revenue" fill="#3b82f6" /> {/* Added revenue bar */}
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
                                <CardHeader>
                                    <CardTitle>Morph Distribution</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={80}
                                                fill="#8884d8"
                                                dataKey="value"
                                                label={({ name, value }) => `${name}: ${value}`}
                                            >
                                                {pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
