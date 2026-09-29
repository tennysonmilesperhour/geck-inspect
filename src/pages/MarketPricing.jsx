/**
 * Market Pricing: what crested geckos are listed for, by trait.
 *
 * The main table is the Geck Data trait value table (public.trait_value_table,
 * via lib/traitValueTable.js): asking-price bands from the scraped MorphMarket
 * listings, split by age and sex. The same numbers drive the Portfolio, the
 * gecko value estimate and the Pairing Planner, so this page cannot disagree
 * with them. They are asking prices and the page says so.
 *
 * Below it, sales that Geck Inspect breeders log themselves
 * (public.morph_price_entries). Until 28 Sep 2026 that table held 24 seeded
 * rows shown as recent sales, and each row showed a random trend arrow; both
 * are gone (supabase/migrations/_applied_by_hand/20260928200000_delete_seeded_price_entries.sql).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { DollarSign, Plus, Search } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { loadTraitValueIndex } from '@/lib/traitValueTable';
import { createPageUrl } from '@/utils';
import Seo from '@/components/seo/Seo';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const AGES = [
  ['any', 'All ages'], ['hatchling', 'Hatchlings'], ['juvenile', 'Juveniles'], ['subadult', 'Subadults'], ['adult', 'Adults'],
];
const SEXES = [['any', 'All sexes'], ['female', 'Females'], ['male', 'Males'], ['unsexed', 'Unsexed']];
const GRADES = ['pet', 'breeder', 'high_end', 'investment'];
// A band from fewer listings than this is too thin to show.
const MIN_LISTINGS = 5;

const money = (v) => `$${Math.round(Number(v) || 0).toLocaleString('en-US')}`;
const label = (v) => String(v || '').replace(/_/g, ' ');

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const EMPTY_SALE = {
  base_morph: '', pattern_grade: 'breeder', sex: 'female', age_category: 'adult',
  sale_price: '', sale_date: format(new Date(), 'yyyy-MM-dd'), is_anonymous: true,
};

export default function MarketPricing() {
  const { user } = useAuth() || {};
  // Guest demo mode has a stand-in user, but the price table and sale log
  // need a real account, so guests see the sign-up card.
  const signedIn = !!user && !user.is_guest;
  const [index, setIndex] = useState(null);
  const [indexState, setIndexState] = useState('loading'); // loading | ready | error
  const [age, setAge] = useState('any');
  const [sex, setSex] = useState('any');
  const [query, setQuery] = useState('');
  const [sales, setSales] = useState([]);
  const [saleOpen, setSaleOpen] = useState(false);
  const [sale, setSale] = useState(EMPTY_SALE);
  const [saving, setSaving] = useState(false);
  const [saleError, setSaleError] = useState('');

  useEffect(() => {
    if (!signedIn) return undefined;
    let cancelled = false;
    loadTraitValueIndex()
      .then((idx) => { if (!cancelled) { setIndex(idx); setIndexState('ready'); } })
      .catch(() => { if (!cancelled) setIndexState('error'); });
    return () => { cancelled = true; };
  }, [signedIn]);

  const loadSales = async () => {
    const { data } = await supabase.from('morph_price_entries').select('*').order('sale_date', { ascending: false });
    setSales(data || []);
  };
  useEffect(() => { loadSales(); }, []);

  const rows = useMemo(() => {
    if (!index) return [];
    const needle = query.trim().toLowerCase();
    const out = [];
    for (const trait of index.traits.values()) {
      if (needle && !trait.name.toLowerCase().includes(needle)) continue;
      const band = trait.bands.get(`${age}|${sex}`);
      if (!band || band.n < MIN_LISTINGS) continue;
      out.push({ name: trait.name, ...band });
    }
    return out.sort((a, b) => b.n - a.n);
  }, [index, age, sex, query]);

  const loggedSales = useMemo(() => {
    const groups = new Map();
    for (const entry of sales) {
      const key = String(entry.base_morph || '').trim();
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }
    return [...groups.entries()]
      .map(([morph, entries]) => {
        const prices = entries.map((e) => Number(e.sale_price)).filter((p) => p > 0);
        return { morph, entries, count: prices.length, median: prices.length ? median(prices) : 0 };
      })
      .sort((a, b) => b.count - a.count);
  }, [sales]);

  const submitSale = async () => {
    if (!sale.base_morph.trim() || !(Number(sale.sale_price) > 0) || saving) return;
    setSaving(true);
    setSaleError('');
    const { error } = await supabase.from('morph_price_entries').insert({
      ...sale,
      base_morph: sale.base_morph.trim(),
      sale_price: Number(sale.sale_price),
      source: 'user_submitted',
      // submitted_by is a uuid; user.id is the profile id, which for 87 of
      // 135 accounts is an old-platform id that is not a uuid, so their
      // sale never saved (fixed 29 Sep 2026). auth_user_id is the sign-in id.
      submitted_by: user?.auth_user_id || null,
      created_by: user?.email,
    });
    setSaving(false);
    if (error) {
      // Say so instead of leaving the dialog open with no sign of why.
      setSaleError('That sale did not save. Check the fields and try again.');
      return;
    }
    setSaleOpen(false);
    setSale(EMPTY_SALE);
    loadSales();
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <Seo
        title="Crested Gecko Market Pricing"
        description="Asking-price ranges for crested gecko traits from MorphMarket listings, by age and sex."
        path="/MarketPricing"
        noIndex
      />
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader
          icon={DollarSign}
          title="Market Pricing"
          description="What crested geckos are listed for on MorphMarket, by trait. These are asking prices: animals often sell for less, and pattern quality moves the price more than any single trait."
        >
          {signedIn && (
            <Button onClick={() => setSaleOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Log a sale
            </Button>
          )}
        </PageHeader>

        {!signedIn ? (
          <Card>
            <CardContent className="p-4 md:p-6">
              <p className="text-base font-semibold text-slate-100">Sign in to see asking-price ranges by trait, age and sex.</p>
              <p className="text-sm text-slate-400 mt-3">
                The ranges come from thousands of crested gecko listings and are free with any account.
              </p>
              <Button asChild className="mt-4">
                <Link to="/AuthPortal?mode=signup">Start free</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-slate-100 text-base">Asking prices by trait</CardTitle>
              <div className="flex flex-wrap gap-2 pt-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-2.5" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Find a trait"
                    className="pl-8 w-44 bg-slate-800 border-slate-600 text-slate-100"
                  />
                </div>
                <Select value={age} onValueChange={setAge}>
                  <SelectTrigger className="w-36 bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600 text-slate-100">
                    {AGES.map(([value, text]) => <SelectItem key={value} value={value}>{text}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={sex} onValueChange={setSex}>
                  <SelectTrigger className="w-36 bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600 text-slate-100">
                    {SEXES.map(([value, text]) => <SelectItem key={value} value={value}>{text}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {indexState === 'loading' && <p className="text-sm text-slate-400 px-6 pb-6">Loading listing prices...</p>}
              {indexState === 'error' && (
                <p className="text-sm text-amber-300 px-6 pb-6">Listing prices could not load. Try again in a minute.</p>
              )}
              {indexState === 'ready' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-800">
                        <th className="py-2.5 px-4 font-medium">Trait</th>
                        <th className="py-2.5 px-4 font-medium text-right">Low</th>
                        <th className="py-2.5 px-4 font-medium text-right">Median</th>
                        <th className="py-2.5 px-4 font-medium text-right">High</th>
                        <th className="py-2.5 px-4 font-medium text-right">Listings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.name} className="border-b border-slate-800/60 last:border-0">
                          <td className="py-2.5 px-4 text-slate-100 font-medium">{row.name}</td>
                          <td className="py-2.5 px-4 text-right text-slate-300">{money(row.p25)}</td>
                          <td className="py-2.5 px-4 text-right text-emerald-300 font-semibold">{money(row.p50)}</td>
                          <td className="py-2.5 px-4 text-right text-slate-300">{money(row.p75)}</td>
                          <td className="py-2.5 px-4 text-right text-slate-500">{row.n.toLocaleString('en-US')}</td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr><td colSpan={5} className="text-center py-10 text-slate-500">No trait has {MIN_LISTINGS} or more listings for this filter.</td></tr>
                      )}
                    </tbody>
                  </table>
                  <p className="text-xs text-slate-500 px-4 py-3 border-t border-slate-800">
                    Low and high are the middle half of listings (25th to 75th percentile). A gecko with
                    several traits usually lists near its most valuable one. The same numbers price your{' '}
                    <Link to={createPageUrl('Portfolio')} className="text-emerald-400 hover:text-emerald-300">Portfolio</Link>{' '}
                    and the Pairing Planner.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-100 text-base">Sales logged by Geck Inspect breeders</CardTitle>
            <p className="text-sm text-slate-400">What animals actually sold for, shared without names.</p>
          </CardHeader>
          <CardContent>
            {loggedSales.length === 0 ? (
              <p className="text-sm text-slate-400">
                No sales logged yet. {signedIn ? 'Log one of yours to help other breeders price theirs.' : 'Sign in to log yours.'}
              </p>
            ) : (
              <div className="space-y-2">
                {loggedSales.map((group) => (
                  <div key={group.morph} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2 text-sm">
                    <span className="text-slate-100 font-medium">{group.morph}</span>
                    <span className="text-slate-400">
                      {group.count} sale{group.count === 1 ? '' : 's'} · median <span className="text-emerald-300 font-semibold">{money(group.median)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={saleOpen} onOpenChange={(open) => { setSaleOpen(open); setSaleError(''); }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200">
          <DialogHeader><DialogTitle className="text-slate-100">Log a sale</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-slate-300">Morph</Label>
              <Input
                value={sale.base_morph}
                onChange={(e) => setSale((s) => ({ ...s, base_morph: e.target.value }))}
                placeholder="e.g. Lilly White, Extreme Harlequin"
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['pattern_grade', 'Grade', GRADES],
                ['sex', 'Sex', ['male', 'female', 'unsexed']],
                ['age_category', 'Age', ['hatchling', 'juvenile', 'subadult', 'adult']],
              ].map(([key, text, options]) => (
                <div key={key}>
                  <Label className="text-slate-300">{text}</Label>
                  <Select value={sale[key]} onValueChange={(v) => setSale((s) => ({ ...s, [key]: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600 text-slate-100">
                      {options.map((o) => <SelectItem key={o} value={o} className="capitalize">{label(o)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div>
                <Label className="text-slate-300">Sold for ($)</Label>
                <Input
                  type="number"
                  min="0"
                  value={sale.sale_price}
                  onChange={(e) => setSale((s) => ({ ...s, sale_price: e.target.value }))}
                  className="bg-slate-800 border-slate-600"
                />
              </div>
            </div>
            <div>
              <Label className="text-slate-300">Sale date</Label>
              <Input
                type="date"
                value={sale.sale_date}
                onChange={(e) => setSale((s) => ({ ...s, sale_date: e.target.value }))}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <p className="text-xs text-slate-500">Shown without your name. Only the morph, grade, sex, age, price and date are shared.</p>
            {saleError && <p role="alert" className="text-sm text-rose-300">{saleError}</p>}
            <Button onClick={submitSale} disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700">
              {saving ? 'Saving...' : 'Save sale'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
