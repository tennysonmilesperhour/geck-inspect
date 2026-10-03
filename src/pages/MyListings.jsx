
import { useState, useEffect } from 'react';
import { Gecko, User } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
import { GUEST_USER, isGuestMode } from '@/lib/guestMode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import InquiriesInbox from '@/components/marketplace/InquiriesInbox';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, subMonths } from 'date-fns';
import { isSoldGecko, saleAmount, saleDate as ledgerSaleDate } from '@/lib/businessLedger';
import { parseLocalDate } from '@/lib/dateUtils';
import {
  DollarSign,
  Eye,
  TrendingUp,
  ShoppingCart,
  Calendar,
  ExternalLink,
  Edit,
  MessageCircle,
  ListChecks
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';


const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6', '#ec4899'];

export default function MyListingsPage() {
    const [_user, setUser] = useState(null);
    const [geckos, setGeckos] = useState([]);
    const [analytics, setAnalytics] = useState({
        totalListings: 0,
        totalValue: 0,
        sold: 0,
        active: 0,
        inquiries: 0
    });
    const [salesData, setSalesData] = useState([]); // Added state for sales data
    const [_isLoading, setIsLoading] = useState(true);
    const [newInquiries, setNewInquiries] = useState(0);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                // Demo mode has no sign-in; show the demo collection's
                // sample listings instead of failing on a null user.
                const currentUser = isGuestMode() ? GUEST_USER : await User.me();
                setUser(currentUser);

                const userGeckos = await Gecko.filter({ created_by: currentUser.email }, '-created_date');
                // Sold geckos are archived (Mark sold and Archive as sold both do
                // that), so filtering out archived rows emptied the Sold tab,
                // the sold count and the chart. Business Tools' ledger rules
                // decide what counts as sold.
                const marketplaceGeckos = userGeckos.filter(g => isSoldGecko(g) || (!g.archived && g.status === 'For Sale'));
                setGeckos(marketplaceGeckos);

                // Calculate analytics with real data
                const totalValue = marketplaceGeckos.reduce((sum, g) => sum + (g.asking_price || 0), 0);
                const soldGeckosFromFetch = marketplaceGeckos.filter(isSoldGecko);
                const active = marketplaceGeckos.filter(g => !isSoldGecko(g)).length;

                // Real inquiry count from breeder_inquiries (written by the
                // send-breeder-inquiry edge function; RLS lets a breeder
                // read only their own rows). Listing views are not tracked
                // anywhere yet, so no Views tile is shown at all.
                let inquiries = 0;
                if (!isGuestMode()) try {
                    const { count } = await supabase
                        .from('breeder_inquiries')
                        .select('id', { count: 'exact', head: true })
                        .ilike('breeder_email', currentUser.email);
                    inquiries = count || 0;
                    const { count: unread } = await supabase
                        .from('breeder_inquiries')
                        .select('id', { count: 'exact', head: true })
                        .ilike('breeder_email', currentUser.email)
                        .is('read_at', null)
                        .is('replied_at', null);
                    setNewInquiries(unread || 0);
                } catch {
                    inquiries = 0;
                }

                setAnalytics({
                    totalListings: marketplaceGeckos.length,
                    totalValue,
                    sold: soldGeckosFromFetch.length, // Use length of filtered sold geckos
                    active,
                    inquiries
                });
                
                // Generate real sales data for the chart
                const monthlySales = {};
                for (let i = 5; i >= 0; i--) {
                    const date = subMonths(new Date(), i);
                    // Month and year, so a sale from last year's September
                    // doesn't count toward this one.
                    const monthKey = format(date, 'MMM yy');
                    monthlySales[monthKey] = { sales: 0, revenue: 0 };
                }

                soldGeckosFromFetch.forEach(gecko => {
                    const when = ledgerSaleDate(gecko);
                    if (!when) return;
                    const saleDate = parseLocalDate(when);
                    if (!saleDate || isNaN(saleDate.getTime())) return;
                    const monthKey = format(saleDate, 'MMM yy');
                    if (monthlySales[monthKey]) {
                        monthlySales[monthKey].sales += 1;
                        // The sold price when recorded, not the asking price.
                        monthlySales[monthKey].revenue += saleAmount(gecko).amount;
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

    const activeListings = geckos.filter(g => !isSoldGecko(g));
    const soldGeckos = geckos.filter(isSoldGecko);
    
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
            <Card>
                <div className="relative">
                    {primaryImage ? (
                        <img 
                            src={primaryImage} 
                            alt={gecko.name}
                            className="w-full h-32 object-cover rounded-t-lg"
                        />
                    ) : (
                        <div className="w-full h-32 rounded-t-lg bg-slate-800 flex items-center justify-center">
                            <ShoppingCart className="w-8 h-8 text-slate-500" />
                        </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-2">
                        <Badge className={`text-xs border ${
                            gecko.status === 'For Sale' ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40' :
                            'bg-slate-900/80 text-slate-300 border-slate-600'
                        }`}>
                            {gecko.status}
                        </Badge>
                        {gecko.asking_price && (
                            <Badge className="bg-slate-900/80 text-slate-100 border border-slate-600 text-xs">
                                ${gecko.asking_price}
                            </Badge>
                        )}
                    </div>
                </div>

                <CardContent className="p-4">
                    <div className="space-y-3">
                        <div>
                            <h3 className="font-semibold text-slate-100">{gecko.name}</h3>
                            {gecko.morphs_traits && (
                                <p className="text-sm text-slate-400">{gecko.morphs_traits}</p>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-sm text-slate-400">
                            <span className={`px-2 py-0.5 rounded text-xs border ${
                                gecko.sex === 'Male' ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' :
                                gecko.sex === 'Female' ? 'bg-pink-500/15 text-pink-300 border-pink-500/30' :
                                'bg-slate-800 text-slate-300 border-slate-600'
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
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <PageHeader
                    icon={ListChecks}
                    title="My Listings"
                    description="Track your gecko sales and marketplace performance"
                />

                {/* Analytics Overview */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                    <Card>
                        <CardContent className="p-4 text-center">
                            <ShoppingCart className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-slate-100">{analytics.totalListings}</div>
                            <div className="text-xs text-slate-400">Total Listings</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4 text-center">
                            <DollarSign className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-slate-100">${analytics.totalValue}</div>
                            <div className="text-xs text-slate-400">Total Value</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4 text-center">
                            <TrendingUp className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-slate-100">{analytics.sold}</div>
                            <div className="text-xs text-slate-400">Sold</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4 text-center">
                            <Calendar className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-slate-100">{analytics.active}</div>
                            <div className="text-xs text-slate-400">Active</div>
                        </CardContent>
                    </Card>

                    {/* Fifth tile spans the phone row so it doesn't sit alone. */}
                    <Card className="col-span-2 md:col-span-1">
                        <CardContent className="p-4 text-center">
                            <MessageCircle className="w-6 h-6 text-orange-400 mx-auto mb-2" />
                            <div className="text-2xl font-bold text-slate-100">{analytics.inquiries}</div>
                            <div className="text-xs text-slate-400">Inquiries</div>
                        </CardContent>
                    </Card>
                </div>

                <Tabs defaultValue="active">
                    <TabsList className="mb-6 flex-wrap h-auto">
                        <TabsTrigger value="active"><span className="hidden sm:inline">Active Listings</span><span className="sm:hidden">Active</span> ({activeListings.length})</TabsTrigger>
                        <TabsTrigger value="sold">Sold ({soldGeckos.length})</TabsTrigger>
                        <TabsTrigger value="inquiries">Inquiries{newInquiries > 0 ? ` (${newInquiries} new)` : ''}</TabsTrigger>
                        <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    </TabsList>

                    {/* Active Listings */}
                    <TabsContent value="active">
                        {activeListings.length === 0 ? (
                            <Card>
                                <CardContent className="p-8 text-center">
                                    <ShoppingCart className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-slate-100 mb-2">No active listings</h3>
                                    <p className="text-slate-400 mb-4">Start selling by creating your first listing</p>
                                    <Link to={createPageUrl('MarketplaceSell')}>
                                        <Button>
                                            Create Listing
                                        </Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {activeListings.map(gecko => (
                                    <GeckoListingCard key={gecko.id} gecko={gecko} />
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* Sold Listings */}
                    <TabsContent value="sold">
                        {soldGeckos.length === 0 ? (
                            <Card>
                                <CardContent className="p-8 text-center">
                                    <TrendingUp className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-slate-100 mb-2">No sales yet</h3>
                                    <p className="text-slate-400">Your sold geckos will appear here</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {soldGeckos.map(gecko => (
                                    <GeckoListingCard key={gecko.id} gecko={gecko} />
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* Analytics */}
                    <TabsContent value="inquiries">
                        {isGuestMode() ? (
                            <p className="text-sm text-slate-400 py-6">Buyer inquiries show here once you have your own account.</p>
                        ) : (
                            <InquiriesInbox userEmail={_user?.email} onCountChange={setNewInquiries} />
                        )}
                    </TabsContent>

                    <TabsContent value="analytics">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <Card>
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

                            <Card>
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
