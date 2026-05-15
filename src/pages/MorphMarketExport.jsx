import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gecko, User } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  Download,
  Copy,
  Check,
  ExternalLink,
  Filter,
  Search,
  Plus,
  X,
  AlertTriangle,
  Crown,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import {
  buildMorphMarketCSV,
  buildMorphMarketRow,
  exportMorphMarketCSV,
  MM_HEADERS,
} from '@/lib/morphmarketSync';

/**
 * MorphMarket Bulk Export Builder.
 *
 * Replaces the "single click, dump every For Sale gecko" CSV export
 * with a staging surface the breeder can curate. Pick from filtered
 * lists (weight ranges, hatch-month windows, sex, status, etc.),
 * batch them in, and download a CSV that matches MorphMarket's
 * Bulk Import 2.0 column spec exactly.
 *
 * Geckos that are already in the batch get pulled out of the pool so
 * the breeder can keep filtering and selecting without re-seeing them.
 */

const STATUS_OPTIONS = ['For Sale', 'Pet', 'Future Breeder', 'Holdback', 'Ready to Breed', 'Proven', 'Sold'];
const SEX_OPTIONS = ['Male', 'Female', 'Unsexed'];

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const REQUIRED_FIELDS = [
  { key: 'sex', label: 'Sex', test: (g) => g.sex && g.sex !== 'Unknown' },
  { key: 'morphs_traits', label: 'Traits', test: (g) => Boolean((g.morphs_traits && g.morphs_traits.trim()) || (Array.isArray(g.morph_tags) && g.morph_tags.length > 0)) },
  { key: 'asking_price', label: 'Price', test: (g) => g.asking_price != null && g.asking_price !== '' },
  { key: 'image_urls', label: 'At least 1 image', test: (g) => Array.isArray(g.image_urls) && g.image_urls.length > 0 },
];

function missingFields(gecko) {
  return REQUIRED_FIELDS.filter((f) => !f.test(gecko)).map((f) => f.label);
}

function ageMonths(hatchDate) {
  if (!hatchDate) return null;
  const d = new Date(hatchDate);
  if (isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

function maturityLabel(months) {
  if (months == null) return 'Unknown';
  if (months < 3) return 'Baby';
  if (months < 8) return 'Juvenile';
  if (months < 14) return 'Sub-Adult';
  return 'Adult';
}

function FilterPanel({ filters, setFilters, onReset }) {
  const update = (patch) => setFilters((f) => ({ ...f, ...patch }));
  return (
    <Card className="border-slate-800 bg-slate-900/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
          <Filter className="w-4 h-4 text-emerald-400" />
          Filter geckos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search by name, ID, or trait..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="pl-10 bg-slate-800 border-slate-700 text-slate-100"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-slate-400">Status</Label>
            <Select value={filters.status} onValueChange={(v) => update({ status: v })}>
              <SelectTrigger className="h-9 bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 z-[99999]">
                <SelectItem value="any" className="focus:bg-slate-700">Any status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="focus:bg-slate-700">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-400">Sex</Label>
            <Select value={filters.sex} onValueChange={(v) => update({ sex: v })}>
              <SelectTrigger className="h-9 bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 z-[99999]">
                <SelectItem value="any" className="focus:bg-slate-700">Any</SelectItem>
                {SEX_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="focus:bg-slate-700">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-slate-400">Min weight (g)</Label>
            <Input
              type="number"
              step="0.1"
              value={filters.weightMin}
              onChange={(e) => update({ weightMin: e.target.value })}
              placeholder="e.g. 30"
              className="h-9 bg-slate-800 border-slate-700 text-slate-100"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Max weight (g)</Label>
            <Input
              type="number"
              step="0.1"
              value={filters.weightMax}
              onChange={(e) => update({ weightMax: e.target.value })}
              placeholder="e.g. 50"
              className="h-9 bg-slate-800 border-slate-700 text-slate-100"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-slate-400">Hatched between</Label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-slate-500">From</Label>
              <Input
                type="date"
                value={filters.bornAfter}
                onChange={(e) => update({ bornAfter: e.target.value })}
                className="h-9 bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-slate-500">To</Label>
              <Input
                type="date"
                value={filters.bornBefore}
                onChange={(e) => update({ bornBefore: e.target.value })}
                className="h-9 bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-slate-500">Born in month</Label>
              <Select value={filters.bornMonth} onValueChange={(v) => update({ bornMonth: v })}>
                <SelectTrigger className="h-9 bg-slate-800 border-slate-700 text-slate-100">
                  <SelectValue placeholder="Any month" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 z-[99999]">
                  <SelectItem value="any" className="focus:bg-slate-700">Any month</SelectItem>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="focus:bg-slate-700">{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-slate-500">Born in year</Label>
              <Input
                type="number"
                value={filters.bornYear}
                onChange={(e) => update({ bornYear: e.target.value })}
                placeholder="e.g. 2025"
                className="h-9 bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <Checkbox
              checked={filters.requirePrice}
              onCheckedChange={(v) => update({ requirePrice: !!v })}
            />
            Has asking price
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <Checkbox
              checked={filters.requireImage}
              onCheckedChange={(v) => update({ requireImage: !!v })}
            />
            Has at least 1 image
          </label>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 w-full"
        >
          Reset filters
        </Button>
      </CardContent>
    </Card>
  );
}

function GeckoTile({ gecko, selected, onToggle }) {
  const thumb = Array.isArray(gecko.image_urls) && gecko.image_urls[0];
  const missing = missingFields(gecko);
  return (
    <button
      type="button"
      onClick={() => onToggle(gecko.id)}
      className={`text-left rounded-xl border bg-slate-900/60 transition overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
        selected
          ? 'border-emerald-500 ring-1 ring-emerald-500/40'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="relative aspect-square bg-slate-950">
        {thumb ? (
          <img src={thumb} alt={gecko.name || ''} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-700 text-xs">No photo</div>
        )}
        <div className="absolute top-2 left-2">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggle(gecko.id)}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900/80 border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
          />
        </div>
        {missing.length > 0 && (
          <div className="absolute top-2 right-2 bg-amber-500/90 text-amber-950 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {missing.length}
          </div>
        )}
      </div>
      <div className="p-2.5 space-y-1">
        <p className="text-sm font-semibold text-slate-100 truncate">{gecko.name || 'Unnamed'}</p>
        <p className="text-[11px] text-slate-500 truncate">
          {gecko.gecko_id_code || 'No ID'} · {gecko.sex || 'Unsexed'}
        </p>
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-slate-400">
            {gecko.weight_grams != null ? `${gecko.weight_grams}g` : 'No weight'}
          </span>
          <span className="text-emerald-300 font-semibold">
            {gecko.asking_price != null ? `$${gecko.asking_price}` : 'No price'}
          </span>
        </div>
        <p className="text-[10px] text-slate-500 truncate">
          {gecko.morphs_traits || (Array.isArray(gecko.morph_tags) ? gecko.morph_tags.join(', ') : '')}
        </p>
      </div>
    </button>
  );
}

function BatchTable({ geckos, onRemove }) {
  if (geckos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-6 text-center">
        <p className="text-sm text-slate-400">No geckos in the batch yet.</p>
        <p className="text-xs text-slate-500 mt-1">
          Filter and select on the left, then click "Add to batch" to stage them for export.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-slate-500 flex items-center gap-1">
        <ArrowRight className="w-3 h-3" /> Scroll horizontally to see all {MM_HEADERS.length} MorphMarket columns.
      </p>
      <div className="relative rounded-xl border border-slate-800 bg-slate-950/40">
        <div className="overflow-x-scroll rounded-xl">
          <table className="w-full text-xs">
            <thead className="bg-slate-900 text-slate-400 sticky top-0">
              <tr>
                <th className="text-left px-2 py-2 font-medium">#</th>
                {MM_HEADERS.map((h) => (
                  <th key={h} className="text-left px-2 py-2 font-medium whitespace-nowrap">{h}</th>
                ))}
                <th className="text-right px-2 py-2 font-medium">Remove</th>
              </tr>
            </thead>
            <tbody>
              {geckos.map((g, i) => {
                const row = buildMorphMarketRow(g);
                const missing = missingFields(g);
                return (
                  <tr
                    key={g.id}
                    className={`border-t border-slate-800 hover:bg-slate-900/60 ${
                      missing.length > 0 ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    <td className="px-2 py-2 text-slate-500">{i + 1}</td>
                    {MM_HEADERS.map((h) => (
                      <td key={h} className="px-2 py-2 text-slate-200 align-top max-w-[12rem]">
                        <div className="truncate" title={String(row[h] ?? '')}>{String(row[h] ?? '')}</div>
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onRemove(g.id)}
                        className="text-slate-500 hover:text-rose-400 inline-flex items-center"
                        title="Remove from batch"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-0 h-full w-8 rounded-r-xl bg-gradient-to-l from-slate-950/80 to-transparent"
        />
      </div>
    </div>
  );
}

const DEFAULT_FILTERS = {
  search: '',
  status: 'any',
  sex: 'any',
  weightMin: '',
  weightMax: '',
  bornAfter: '',
  bornBefore: '',
  bornMonth: 'any',
  bornYear: '',
  requirePrice: false,
  requireImage: false,
};

export default function MorphMarketExport() {
  const [user, setUser] = useState(null);
  const [allGeckos, setAllGeckos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selected, setSelected] = useState(() => new Set());
  const [batchIds, setBatchIds] = useState(() => []);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const me = await User.me();
        if (cancelled) return;
        setUser(me);
        if (me) {
          const list = await Gecko.filter({ created_by: me.email }, '-created_date');
          if (!cancelled) {
            setAllGeckos((list || []).filter((g) => !g.archived && !g.notes?.startsWith('[Manual sale]')));
          }
        }
      } catch (err) {
        console.error('Failed to load geckos for MorphMarket export:', err);
      }
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tier = user?.membership_tier || 'free';
  const isAdmin = user?.role === 'admin';
  const isGrandfathered = user?.subscription_status === 'grandfathered';
  const hasAccess = tier === 'breeder' || tier === 'enterprise' || isAdmin || isGrandfathered;

  const batchSet = useMemo(() => new Set(batchIds), [batchIds]);
  const batchGeckos = useMemo(
    () => batchIds.map((id) => allGeckos.find((g) => g.id === id)).filter(Boolean),
    [batchIds, allGeckos],
  );

  const pool = useMemo(
    () => allGeckos.filter((g) => !batchSet.has(g.id)),
    [allGeckos, batchSet],
  );

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const wMin = filters.weightMin === '' ? null : Number(filters.weightMin);
    const wMax = filters.weightMax === '' ? null : Number(filters.weightMax);
    const after = filters.bornAfter ? new Date(filters.bornAfter) : null;
    const before = filters.bornBefore ? new Date(filters.bornBefore) : null;
    const month = filters.bornMonth === 'any' ? null : Number(filters.bornMonth);
    const year = filters.bornYear === '' ? null : Number(filters.bornYear);

    return pool.filter((g) => {
      if (q) {
        const hay = [g.name, g.gecko_id_code, g.morphs_traits, ...(g.morph_tags || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.status !== 'any' && g.status !== filters.status) return false;
      if (filters.sex !== 'any') {
        if (filters.sex === 'Unsexed' && g.sex && g.sex !== 'Unsexed' && g.sex !== 'Unknown') return false;
        if (filters.sex !== 'Unsexed' && g.sex !== filters.sex) return false;
      }
      if (wMin != null && (g.weight_grams == null || Number(g.weight_grams) < wMin)) return false;
      if (wMax != null && (g.weight_grams == null || Number(g.weight_grams) > wMax)) return false;
      if (after || before || month != null || year != null) {
        if (!g.hatch_date) return false;
        const d = new Date(g.hatch_date);
        if (isNaN(d.getTime())) return false;
        if (after && d < after) return false;
        if (before && d > before) return false;
        if (month != null && d.getMonth() + 1 !== month) return false;
        if (year != null && d.getFullYear() !== year) return false;
      }
      if (filters.requirePrice && (g.asking_price == null || g.asking_price === '')) return false;
      if (filters.requireImage && !(Array.isArray(g.image_urls) && g.image_urls.length > 0)) return false;
      return true;
    });
  }, [pool, filters]);

  const toggleSelected = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleSelectedCount = filtered.reduce((acc, g) => acc + (selected.has(g.id) ? 1 : 0), 0);
  const allVisibleSelected = filtered.length > 0 && visibleSelectedCount === filtered.length;

  const toggleSelectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const g of filtered) next.delete(g.id);
      } else {
        for (const g of filtered) next.add(g.id);
      }
      return next;
    });
  };

  const addSelectedToBatch = () => {
    const ids = Array.from(selected).filter((id) => !batchSet.has(id));
    if (ids.length === 0) {
      toast({
        title: 'Nothing to add',
        description: 'Select one or more geckos in the pool first.',
      });
      return;
    }
    setBatchIds((prev) => [...prev, ...ids]);
    setSelected(new Set());
    toast({
      title: `Added ${ids.length} to batch`,
      description: 'They\'ve been moved out of the pool. Keep filtering to add more.',
    });
  };

  const removeFromBatch = (id) => {
    setBatchIds((prev) => prev.filter((x) => x !== id));
  };

  const clearBatch = () => {
    setBatchIds([]);
    setSelected(new Set());
  };

  const handleDownload = () => {
    if (batchGeckos.length === 0) {
      toast({ title: 'Batch is empty', description: 'Add some geckos first.', variant: 'destructive' });
      return;
    }
    const filename = exportMorphMarketCSV(batchGeckos);
    toast({
      title: 'CSV downloaded',
      description: `${batchGeckos.length} listing${batchGeckos.length === 1 ? '' : 's'} saved to ${filename}.`,
    });
  };

  const handleCopy = async () => {
    if (batchGeckos.length === 0) return;
    try {
      await navigator.clipboard.writeText(buildMorphMarketCSV(batchGeckos));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Your browser blocked clipboard access. Use Download instead.',
        variant: 'destructive',
      });
    }
  };

  const batchMissingCount = batchGeckos.filter((g) => missingFields(g).length > 0).length;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card className="border-slate-800 bg-slate-900/60">
          <CardContent className="p-8 text-center space-y-4">
            <Crown className="w-10 h-10 text-emerald-400 mx-auto" />
            <h1 className="text-xl font-bold text-white">MorphMarket Bulk Export</h1>
            <p className="text-sm text-slate-400">
              Build a curated MorphMarket CSV from your collection. Available on the Breeder tier.
            </p>
            <Link to={createPageUrl('Membership')}>
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-white">Upgrade</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 pb-28">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">MorphMarket Bulk Export</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Filter your collection, batch the geckos you want to list, and download a CSV that drops straight into{' '}
            <a
              href="https://www.morphmarket.com/me/ads/import/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 underline underline-offset-2"
            >
              MorphMarket Bulk Import
              <ExternalLink className="w-3 h-3 inline ml-0.5" />
            </a>
            . Selecting a gecko and adding it to the batch removes it from the pool, so you can keep filtering for the next group.
          </p>
        </div>
        <Link to={createPageUrl('MarketplaceSell')}>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            Back to Seller Console
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-6">
        <div className="space-y-4">
          <FilterPanel
            filters={filters}
            setFilters={setFilters}
            onReset={() => setFilters(DEFAULT_FILTERS)}
          />

          <Card className="border-slate-800 bg-slate-900/60">
            <CardContent className="p-4 space-y-2 text-xs text-slate-400">
              <p className="text-slate-300 font-semibold text-sm">Tips</p>
              <p>Click a tile to select it. Click again to deselect. Use "Select all" to grab everything matching the current filter.</p>
              <p>Geckos missing required MorphMarket fields show an amber badge. Open the gecko to fill them in before exporting.</p>
              <p>The CSV download is the same file MorphMarket's Bulk Import 2.0 expects. Upload it on their import page as-is.</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Pool */}
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-bold text-slate-100">
                  Pool <span className="text-slate-500 font-normal">({filtered.length} of {pool.length})</span>
                </h2>
                <p className="text-xs text-slate-500">
                  {selected.size} selected{selected.size > 0 ? ' across all filters' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAllVisible}
                  disabled={filtered.length === 0}
                  className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs h-9"
                >
                  {allVisibleSelected ? 'Deselect all visible' : 'Select all visible'}
                </Button>
                <Button
                  size="sm"
                  onClick={addSelectedToBatch}
                  disabled={selected.size === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add {selected.size > 0 ? `${selected.size} ` : ''}to batch
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center">
                <p className="text-slate-300 font-semibold">No geckos match these filters</p>
                <p className="text-sm text-slate-500 mt-1">
                  {pool.length === 0
                    ? 'Every gecko in your collection is already in the batch.'
                    : 'Try widening the weight range, hatch dates, or status.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {filtered.map((g) => (
                  <GeckoTile
                    key={g.id}
                    gecko={g}
                    selected={selected.has(g.id)}
                    onToggle={toggleSelected}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Batch */}
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-bold text-slate-100">
                  Batch <span className="text-slate-500 font-normal">({batchGeckos.length})</span>
                </h2>
                {batchMissingCount > 0 && (
                  <p className="text-xs text-amber-300 flex items-center gap-1.5 mt-0.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {batchMissingCount} gecko{batchMissingCount === 1 ? '' : 's'} missing required MorphMarket fields. They'll still export, but the upload may reject them.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  disabled={batchGeckos.length === 0}
                  className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs h-9"
                >
                  {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copied ? 'Copied' : 'Copy CSV'}
                </Button>
                <Button
                  size="sm"
                  onClick={handleDownload}
                  disabled={batchGeckos.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Download CSV ({batchGeckos.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearBatch}
                  disabled={batchGeckos.length === 0}
                  className="border-rose-900/40 bg-rose-950/30 hover:bg-rose-950/50 text-rose-300 text-xs h-9"
                >
                  Clear batch
                </Button>
              </div>
            </div>

            <BatchTable geckos={batchGeckos} onRemove={removeFromBatch} />

            {batchGeckos.length > 0 && (
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs h-9"
                >
                  {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copied ? 'Copied' : 'Copy CSV'}
                </Button>
                <Button
                  size="sm"
                  onClick={handleDownload}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Download CSV ({batchGeckos.length})
                </Button>
              </div>
            )}

            {batchGeckos.length > 0 && (
              <details className="rounded-xl border border-slate-800 bg-slate-950/40">
                <summary className="cursor-pointer px-3 py-2 text-xs text-slate-400 hover:text-slate-200">
                  Show summary by maturity
                </summary>
                <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {['Baby', 'Juvenile', 'Sub-Adult', 'Adult'].map((label) => {
                    const count = batchGeckos.filter((g) => maturityLabel(ageMonths(g.hatch_date)) === label).length;
                    return (
                      <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-center">
                        <p className="text-slate-500 uppercase tracking-wider text-[10px]">{label}</p>
                        <p className="text-slate-100 text-lg font-bold">{count}</p>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </section>
        </div>
      </div>

      {batchGeckos.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-200">
              <span className="font-semibold">{batchGeckos.length}</span>
              <span className="text-slate-400"> listing{batchGeckos.length === 1 ? '' : 's'} staged for MorphMarket</span>
              {batchMissingCount > 0 && (
                <span className="ml-3 text-amber-300 inline-flex items-center gap-1 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {batchMissingCount} missing required fields
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs h-9"
              >
                {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copied ? 'Copied' : 'Copy CSV'}
              </Button>
              <Button
                size="sm"
                onClick={handleDownload}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Download CSV ({batchGeckos.length})
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
