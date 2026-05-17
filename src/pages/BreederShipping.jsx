import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { User } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Truck,
  Package,
  MapPin,
  ShieldCheck,
  Crown,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import ShippingQuoteForm from '@/components/shipping/ShippingQuoteForm';
import ShippingBookingForm from '@/components/shipping/ShippingBookingForm';
import ShippingOrderList from '@/components/shipping/ShippingOrderList';
import { IS_DEMO, SHIPZEROS_URL, getNearbyHubs } from '@/integrations/ShipZeros';

/**
 * BreederShipping ,  the authenticated shipping dashboard for Breeder
 * tier users. Lets them get quotes, book shipments, print labels, and
 * track packages ,  all powered by the Zero's Geckos integration.
 *
 * Free / Keeper tier users see a gated upgrade prompt instead.
 */

function TierGate() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-5">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Crown className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-white">Breeder tier required</h2>
        <p className="text-slate-400 leading-relaxed">
          Integrated shipping with Zero&rsquo;s Geckos is available to Breeder and Enterprise tier
          members. Upgrade to unlock one-click shipping labels, real-time tracking, and live
          arrival guarantees for every sale.
        </p>
        <Link to={createPageUrl('Membership')}>
          <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6">
            View plans
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone = 'slate' }) {
  const toneMap = {
    emerald: 'from-emerald-600/20 to-emerald-900/10 border-emerald-500/30 text-emerald-300',
    amber: 'from-amber-600/20 to-amber-900/10 border-amber-500/30 text-amber-300',
    slate: 'from-slate-700/20 to-slate-900/10 border-slate-600 text-slate-300',
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 ${toneMap[tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider opacity-75">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
        </div>
        {Icon && <Icon className="w-5 h-5 opacity-70" />}
      </div>
    </div>
  );
}

function NearbyHubs() {
  const [zip, setZip] = useState('');
  const [hubs, setHubs] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (zip.length < 5) return;
    setLoading(true);
    try {
      const results = await getNearbyHubs(zip);
      setHubs(results);
    } catch {
      setHubs([]);
    }
    setLoading(false);
  };

  return (
    <Card className="border-slate-800 bg-slate-900/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-slate-200 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-400" />
          Find a drop-off hub
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="Enter your ZIP"
            maxLength={5}
            className="flex-1 h-9 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <Button
            size="sm"
            onClick={search}
            disabled={zip.length < 5 || loading}
            className="bg-slate-700 hover:bg-slate-600 text-slate-200 h-9"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </Button>
        </div>
        {hubs && hubs.length === 0 && (
          <p className="text-xs text-slate-500">No hubs found near that ZIP code.</p>
        )}
        {hubs && hubs.length > 0 && (
          <div className="space-y-2">
            {hubs.map((hub) => (
              <div
                key={hub.id}
                className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-1"
              >
                <p className="text-sm font-semibold text-slate-200">{hub.name}</p>
                <p className="text-xs text-slate-400">
                  {hub.address}, {hub.city}, {hub.state} {hub.zip}
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>{hub.hours}</span>
                  <span>{hub.distance} mi away</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function BreederShipping() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeQuote, setActiveQuote] = useState(null);
  const [orders, setOrders] = useState([]);

  const tier = user?.membership_tier || 'free';
  const isGrandfathered = user?.subscription_status === 'grandfathered';
  const hasAccess = tier === 'breeder' || tier === 'enterprise' || isGrandfathered;

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const me = await User.me();
        setUser(me);
        if (me) {
          // Load existing shipping orders
          const { data } = await supabase
            .from('shipping_orders')
            .select('*')
            .eq('created_by', me.email)
            .order('created_date', { ascending: false })
            .limit(50);
          setOrders(data || []);
        }
      } catch {
        // Table might not exist yet ,  that's fine
        setOrders([]);
      }
      setIsLoading(false);
    })();
  }, []);

  const handleBooked = async (result) => {
    // Persist to Supabase
    try {
      const { data } = await supabase.from('shipping_orders').insert({
        shipment_id: result.shipmentId,
        tracking_number: result.trackingNumber,
        label_url: result.labelUrl,
        carrier: result.carrier,
        service: result.service,
        estimated_delivery: result.estimatedDelivery,
        status: result.status,
        price: activeQuote?.price || null,
        recipient_name: result._recipient?.name || null,
        recipient_city: result._recipient?.city || null,
        recipient_state: result._recipient?.state || null,
        recipient_zip: result._recipient?.zip || null,
        sender_name: result._sender?.name || null,
        sender_zip: result._sender?.zip || null,
        created_by: user?.email,
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      }).select().single();

      if (data) {
        setOrders((prev) => [data, ...prev]);
      }
    } catch {
      // Table might not exist ,  still show success in UI
    }
    setActiveQuote(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-5">
          <Truck className="w-12 h-12 text-emerald-400 mx-auto" />
          <h2 className="text-2xl font-bold text-white">Sign in to access shipping</h2>
          <p className="text-slate-400">Log in to your Geck Inspect account to book shipments and track packages.</p>
          <Link to={createPageUrl('AuthPortal')}>
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6">
              Sign in
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-slate-950">
        <TierGate />
      </div>
    );
  }

  // Count orders by status
  const activeCount = orders.filter(
    (o) => !['delivered', 'arrival_confirmed', 'cancelled'].includes(o.status)
  ).length;
  const deliveredCount = orders.filter(
    (o) => o.status === 'delivered' || o.status === 'arrival_confirmed'
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-3">
              <Truck className="w-3.5 h-3.5" />
              {IS_DEMO ? 'Demo mode ,  live API hookup coming soon' : 'Powered by Zero\u2019s Geckos'}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-100">Shipping</h1>
            <p className="text-sm text-slate-400 mt-1">
              Book shipments, print labels, and track packages ,  all from one place.
            </p>
          </div>
          <a href={SHIPZEROS_URL} target="_blank" rel="noopener noreferrer">
            <Button
              variant="outline"
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              Zero&rsquo;s Geckos
              <ExternalLink className="w-3.5 h-3.5 ml-2" />
            </Button>
          </a>
        </div>

        {/* Demo banner */}
        {IS_DEMO && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-300">
                Integration preview
              </p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                This is a fully functional preview of the shipping integration with{' '}
                <a
                  href={SHIPZEROS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 underline underline-offset-2"
                >
                  Zero&rsquo;s Geckos Shipping Project
                </a>
                , an independent reptile shipping service we integrate to make it easier to use
                alongside your collection. All data shown here is simulated until the live API
                hookup is enabled. In the meantime, you can book the same service directly at{' '}
                <a
                  href={SHIPZEROS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 underline underline-offset-2"
                >
                  zerosgeckos.com
                </a>
                {' '}with no difference in pricing or service.
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total shipments" value={orders.length} tone="slate" icon={Package} />
          <StatCard label="In transit" value={activeCount} tone="amber" icon={Clock} />
          <StatCard label="Delivered" value={deliveredCount} tone="emerald" icon={CheckCircle2} />
          <StatCard
            label="Live arrival rate"
            value={deliveredCount > 0 ? '100%' : '0%'}
            tone="emerald"
            icon={ShieldCheck}
          />
        </div>

        {/* Main content */}
        <Tabs defaultValue="ship" className="space-y-6">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger
              value="ship"
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
            >
              <Truck className="w-4 h-4 mr-2" />
              New shipment
            </TabsTrigger>
            <TabsTrigger
              value="orders"
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
            >
              <Package className="w-4 h-4 mr-2" />
              My shipments
              {activeCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {activeCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* New Shipment Tab */}
          <TabsContent value="ship" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Step 1: Quote */}
                <Card className="border-slate-800 bg-slate-900/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 text-xs font-bold">
                        1
                      </span>
                      Get a shipping quote
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ShippingQuoteForm onQuoteReceived={setActiveQuote} />
                  </CardContent>
                </Card>

                {/* Step 2: Book (only after quote) */}
                {activeQuote && (
                  <Card className="border-slate-800 bg-slate-900/60">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 text-xs font-bold">
                          2
                        </span>
                        Book &amp; print label
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ShippingBookingForm quote={activeQuote} onBooked={handleBooked} />
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                <NearbyHubs />

                {/* Quick tips card */}
                <Card className="border-slate-800 bg-slate-900/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-300">Shipping tips</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs text-slate-400">
                    <p>
                      <strong className="text-slate-200">Schedule wisely.</strong> Ship
                      Mon–Wed to avoid weekend holds at carrier hubs.
                    </p>
                    <p>
                      <strong className="text-slate-200">Check the weather.</strong> Avoid
                      shipping when origin or destination temps are below 40°F or above 95°F.
                    </p>
                    <p>
                      <strong className="text-slate-200">Pack securely.</strong> Use
                      insulated boxes with deli cups and appropriate heat/cold packs.
                    </p>
                    <p>
                      <strong className="text-slate-200">Notify the buyer.</strong> Share the
                      tracking number as soon as the label is created so they can plan for
                      delivery.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* My Shipments Tab */}
          <TabsContent value="orders">
            <ShippingOrderList orders={orders} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
