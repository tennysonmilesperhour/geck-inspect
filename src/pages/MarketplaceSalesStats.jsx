import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Gecko, MarketplaceCost } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, TrendingUp, AlertCircle, Trash2, Plus, Save } from 'lucide-react';
import { format } from 'date-fns';

export default function MarketplaceSalesStats() {
  const [user, setUser] = useState(null);
  const [soldGeckos, setSoldGeckos] = useState([]);
  const [priceOverrides, setPriceOverrides] = useState({});
  const [costs, setCosts] = useState([]);
  const [newCostDesc, setNewCostDesc] = useState('');
  const [newCostAmount, setNewCostAmount] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (!currentUser) {
          window.location.href = '/';
          return;
        }
        setUser(currentUser);

        const allGeckos = await Gecko.filter({ created_by: currentUser.email });
        const sold = allGeckos.filter(g => 
          (g.archived && g.archive_reason === 'sold') || 
          (g.status === 'Sold')
        );
        setSoldGeckos(sold);

        // Load costs from DB
        let dbCosts = [];
        try {
          dbCosts = await MarketplaceCost.filter({ user_email: currentUser.email }, '-date');
        } catch (e) {
          console.error('Failed to load costs from DB:', e);
        }

        // One-time migration: if DB is empty and localStorage has data, migrate it
        if (dbCosts.length === 0) {
          try {
            const savedCosts = localStorage.getItem(`marketplace_costs_${currentUser.email}`);
            if (savedCosts) {
              const localCosts = JSON.parse(savedCosts);
              if (localCosts.length > 0) {
                const toCreate = localCosts.map(c => ({
                  user_email: currentUser.email,
                  description: c.description,
                  amount: c.amount,
                  date: c.date,
                }));
                await MarketplaceCost.bulkCreate(toCreate);
                dbCosts = await MarketplaceCost.filter({ user_email: currentUser.email }, '-date');
                localStorage.removeItem(`marketplace_costs_${currentUser.email}`);
              }
            }
          } catch (migrationError) {
            // Migration failed — silently fall back to localStorage
            console.warn('Cost migration failed, using localStorage:', migrationError);
            try {
              const savedCosts = localStorage.getItem(`marketplace_costs_${currentUser.email}`);
              if (savedCosts) setCosts(JSON.parse(savedCosts));
            } catch (e) { /* ignore */ }
          }
        }

        setCosts(dbCosts);
      } catch (error) {
        console.error('Failed to load marketplace stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const getPrice = (gecko) => {
    if (priceOverrides[gecko.id] !== undefined) return parseFloat(priceOverrides[gecko.id]) || 0;
    return gecko.asking_price ? parseFloat(gecko.asking_price) : 0;
  };

  const totalRevenue = soldGeckos.reduce((sum, gecko) => sum + getPrice(gecko), 0);
  const totalCosts = costs.reduce((sum, cost) => sum + cost.amount, 0);
  const netProfit = totalRevenue - totalCosts;

  const currentYear = new Date().getFullYear();
  const ytdRevenue = soldGeckos.reduce((sum, gecko) => {
    const saleYear = gecko.archived_date ? new Date(gecko.archived_date).getFullYear() : new Date(gecko.updated_date).getFullYear();
    return saleYear === currentYear ? sum + getPrice(gecko) : sum;
  }, 0);
  const ytdCosts = costs.reduce((sum, cost) => {
    const costYear = new Date(cost.date).getFullYear();
    return costYear === currentYear ? sum + cost.amount : sum;
  }, 0);

  const handlePriceChange = (geckoId, value) => {
    setPriceOverrides(prev => ({ ...prev, [geckoId]: value }));
  };

  const handleSaveAllPrices = async () => {
    setIsSaving(true);
    const updates = Object.entries(priceOverrides);
    for (const [geckoId, value] of updates) {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        await Gecko.update(geckoId, { asking_price: parsed });
      }
    }
    setIsSaving(false);
  };

  const handleAddCost = async () => {
    if (!newCostDesc || !newCostAmount) return;
    const created = await MarketplaceCost.create({
      user_email: user.email,
      description: newCostDesc,
      amount: parseFloat(newCostAmount),
      date: new Date().toISOString(),
    });
    setCosts(prev => [created, ...prev]);
    setNewCostDesc('');
    setNewCostAmount('');
  };

  const handleRemoveCost = async (costId) => {
    await MarketplaceCost.delete(costId);
    setCosts(prev => prev.filter(c => c.id !== costId));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-6 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-600 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Marketplace Sales Stats</h1>
          <p className="text-slate-400">Track your sales performance and profitability</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-400">${totalRevenue.toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">{soldGeckos.length} geckos sold</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                YTD Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-400">${ytdRevenue.toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">Year to date</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400">Total Costs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-400">${totalCosts.toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">{costs.length} entries</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400">Net Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ${netProfit.toFixed(2)}
              </p>
              <p className="text-xs text-slate-500 mt-1">All time</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="revenue" className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="costs">Costs</TabsTrigger>
          </TabsList>

          <TabsContent value="revenue" className="space-y-4 mt-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-100">Sold Geckos</h3>
                {Object.keys(priceOverrides).length > 0 && (
                  <Button
                    onClick={handleSaveAllPrices}
                    disabled={isSaving}
                    className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                    size="sm"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                )}
              </div>
              {soldGeckos.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-slate-400">No sold geckos found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {soldGeckos.map(gecko => (
                    <div key={gecko.id} className="bg-slate-700 p-4 rounded-lg flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-100 truncate">{gecko.name}</p>
                        <p className="text-xs text-slate-500">
                          {gecko.archived_date ? format(new Date(gecko.archived_date), 'MMM d, yyyy') : format(new Date(gecko.updated_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                        <Label htmlFor={`price-${gecko.id}`} className="text-xs text-slate-400 whitespace-nowrap">
                          Sale Price
                        </Label>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 text-sm">$</span>
                          <Input
                            id={`price-${gecko.id}`}
                            type="number"
                            step="0.01"
                            value={priceOverrides[gecko.id] !== undefined ? priceOverrides[gecko.id] : (gecko.asking_price || '')}
                            onChange={(e) => handlePriceChange(gecko.id, e.target.value)}
                            placeholder="0.00"
                            className="bg-slate-800 border-slate-600 text-slate-100 h-8 text-sm w-28 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                        <p className="text-emerald-400 font-semibold w-16 text-right">${getPrice(gecko).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="costs" className="space-y-4 mt-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-100 mb-4">Track Costs</h3>
                <div className="bg-slate-700 p-4 rounded-lg space-y-3">
                  <div>
                    <Label htmlFor="cost-desc" className="text-sm text-slate-300">Description</Label>
                    <Input
                      id="cost-desc"
                      value={newCostDesc}
                      onChange={(e) => setNewCostDesc(e.target.value)}
                      placeholder="e.g., Food, Supplies, Vet Care"
                      className="bg-slate-800 border-slate-600 text-slate-100 mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cost-amount" className="text-sm text-slate-300">Amount ($)</Label>
                    <Input
                      id="cost-amount"
                      type="number"
                      step="0.01"
                      value={newCostAmount}
                      onChange={(e) => setNewCostAmount(e.target.value)}
                      placeholder="0.00"
                      className="bg-slate-800 border-slate-600 text-slate-100 mt-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <Button onClick={handleAddCost} className="w-full bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Cost
                  </Button>
                </div>
              </div>

              {costs.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-slate-400">No costs tracked yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {costs.map(cost => (
                    <div key={cost.id} className="bg-slate-700 p-4 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-100">{cost.description}</p>
                        <p className="text-xs text-slate-500">{format(new Date(cost.date), 'MMM d, yyyy')}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="text-orange-400 font-semibold">${cost.amount.toFixed(2)}</p>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveCost(cost.id)}
                          className="h-8 w-8 text-red-500 hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {costs.length > 0 && (
                <div className="bg-slate-700 p-4 rounded-lg">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Total Revenue:</span>
                      <span className="text-emerald-400 font-semibold">${totalRevenue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Total Costs:</span>
                      <span className="text-orange-400 font-semibold">${totalCosts.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-slate-600 pt-2 mt-2 flex justify-between text-base font-bold">
                      <span className="text-slate-200">Net Profit:</span>
                      <span className={netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}>${netProfit.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}