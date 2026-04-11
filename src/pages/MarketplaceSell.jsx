import React, { useEffect, useMemo, useState } from 'react';
import { Gecko, User } from '@/entities/all';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  Plus,
  Edit,
  DollarSign,
  Eye,
  EyeOff,
  Save,
  ShoppingBag,
  Loader2,
  CheckCircle2,
  Search,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatDistanceToNowStrict } from 'date-fns';

/**
 * MarketplaceSell — April 2026 professional classifieds-style redesign.
 *
 * Replaces the old "sync with MorphMarket / Marketplace Profile" dumping
 * ground with a focused seller-console layout:
 *
 *   1. Stats strip at the top (live / hidden / sold)
 *   2. "Active Listings" grid — geckos currently visible on the public
 *      marketplace. Each card has a one-click "Visible"/"Hidden" switch
 *      that flips `is_public` without changing the sale status.
 *   3. "Hidden Drafts" grid — status = 'For Sale' but is_public = false.
 *      The breeder is holding them back from the feed but can still
 *      edit price + description. One click republishes.
 *   4. "Your collection" section — everything else. One click promotes
 *      a gecko to "For Sale" (status + is_public + asking price flow).
 *
 * Edit modal still exists but has been tightened. Removed the
 * MorphMarket / Palm Street sync card (sync moved to Enterprise tier).
 * Marketplace profile settings (breeder name, contact email, store
 * URLs) were moved to Settings where they belong.
 */

const SELLABLE_STATUSES = [
  'Pet',
  'Future Breeder',
  'Holdback',
  'Ready to Breed',
  'Proven',
  'For Sale',
  'Sold',
];

function SectionHeader({ title, count, description, right }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-slate-100 flex items-center gap-2">
          {title}
          <span className="text-slate-500 text-base font-normal">({count})</span>
        </h2>
        {description && <p className="text-sm text-slate-400">{description}</p>}
      </div>
      {right}
    </div>
  );
}

function StatCard({ label, value, tone = 'emerald', icon: Icon }) {
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

function ListingCard({ gecko, user, onEdit, onToggleVisible, onUnlist, onMarkSold, isToggling }) {
  const photo = gecko.image_urls?.[0];
  const price = gecko.asking_price;
  const isLive = gecko.status === 'For Sale' && gecko.is_public !== false;
  const isHidden = gecko.status === 'For Sale' && gecko.is_public === false;
  const daysLive = gecko.updated_date
    ? formatDistanceToNowStrict(new Date(gecko.updated_date), { addSuffix: true })
    : null;

  return (
    <Card className="bg-slate-900 border-slate-800 overflow-hidden flex flex-col group hover:border-emerald-500/40 transition-colors">
      {/* Photo */}
      <div className="relative aspect-[4/3] bg-slate-950">
        {photo ? (
          <img
            src={photo}
            alt={gecko.name}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-10 h-10 text-slate-700" />
          </div>
        )}

        {/* Top-left: sex indicator */}
        <div className="absolute top-2 left-2">
          <Badge
            className={`text-xs border ${
              gecko.sex === 'Male'
                ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                : gecko.sex === 'Female'
                  ? 'bg-pink-500/20 text-pink-200 border-pink-500/40'
                  : 'bg-slate-700/60 text-slate-200 border-slate-600'
            }`}
          >
            {gecko.sex === 'Male' ? '♂ Male' : gecko.sex === 'Female' ? '♀ Female' : '? Unsexed'}
          </Badge>
        </div>

        {/* Top-right: visibility badge */}
        <div className="absolute top-2 right-2">
          {isLive && (
            <Badge className="bg-emerald-500/90 text-white border-0 shadow-md">
              <Eye className="w-3 h-3 mr-1" /> Live
            </Badge>
          )}
          {isHidden && (
            <Badge className="bg-slate-700/90 text-slate-200 border-0 shadow-md">
              <EyeOff className="w-3 h-3 mr-1" /> Hidden
            </Badge>
          )}
          {gecko.status === 'Sold' && (
            <Badge className="bg-rose-500/90 text-white border-0 shadow-md">Sold</Badge>
          )}
        </div>

        {/* Bottom gradient with price */}
        {price != null && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/60 to-transparent px-3 pt-8 pb-2">
            <div className="text-2xl font-bold text-white flex items-center">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              {price.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <CardContent className="p-4 flex-1 flex flex-col">
        <h3 className="font-bold text-slate-100 truncate text-base">{gecko.name}</h3>
        <p className="text-xs text-slate-500 truncate font-mono">
          {gecko.gecko_id_code || '—'}
        </p>
        {gecko.morphs_traits && (
          <p className="text-xs text-slate-400 line-clamp-2 mt-2">{gecko.morphs_traits}</p>
        )}

        {/* Meta strip */}
        <div className="flex items-center gap-2 mt-3 text-[11px] text-slate-500 flex-wrap">
          {daysLive && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {daysLive}
            </span>
          )}
          {gecko.morphmarket_url && (
            <a
              href={gecko.morphmarket_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-amber-300"
            >
              <ExternalLink className="w-3 h-3" /> MM
            </a>
          )}
        </div>

        {/* Controls */}
        <div className="mt-auto pt-4 space-y-2">
          {/* Visibility toggle — only for For Sale geckos */}
          {gecko.status === 'For Sale' && (
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                {isLive ? (
                  <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <EyeOff className="w-4 h-4 text-slate-500 shrink-0" />
                )}
                <span className="text-xs text-slate-300 truncate">
                  {isLive ? 'Visible on marketplace' : 'Hidden from marketplace'}
                </span>
              </div>
              <Switch
                checked={isLive}
                onCheckedChange={(checked) => onToggleVisible(gecko, checked)}
                disabled={isToggling}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(gecko)}
              className="flex-1 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
            >
              <Edit className="w-3.5 h-3.5 mr-1" /> Edit
            </Button>
            {gecko.status === 'For Sale' ? (
              <Button
                size="sm"
                onClick={() => onMarkSold(gecko)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Sold
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => onEdit(gecko)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <DollarSign className="w-3.5 h-3.5 mr-1" /> List
              </Button>
            )}
          </div>

          {gecko.status === 'For Sale' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUnlist(gecko)}
              className="w-full text-xs text-slate-500 hover:text-rose-400"
            >
              Remove from marketplace
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MarketplaceSellPage() {
  const [user, setUser] = useState(null);
  const [allGeckos, setAllGeckos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingGecko, setEditingGecko] = useState(null);
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState(null);
  const [formData, setFormData] = useState({
    asking_price: '',
    status: 'For Sale',
    is_public: true,
    marketplace_description: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const currentUser = await User.me();
        if (currentUser) {
          setUser(currentUser);
          const userGeckos = await Gecko.filter(
            { created_by: currentUser.email },
            '-created_date'
          );
          setAllGeckos(userGeckos);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      }
      setIsLoading(false);
    })();
  }, []);

  const handleEdit = (gecko) => {
    setEditingGecko(gecko);
    setFormData({
      asking_price: gecko.asking_price ?? '',
      status: gecko.status === 'Pet' || !gecko.status ? 'For Sale' : gecko.status,
      is_public: gecko.is_public !== false,
      marketplace_description: gecko.marketplace_description || gecko.notes || '',
    });
  };

  const handleSave = async () => {
    if (!editingGecko) return;
    setIsSaving(true);
    try {
      const patch = {
        status: formData.status,
        is_public: formData.is_public,
        asking_price:
          formData.asking_price !== '' && !isNaN(parseFloat(formData.asking_price))
            ? parseFloat(formData.asking_price)
            : null,
        marketplace_description: formData.marketplace_description || null,
      };
      await Gecko.update(editingGecko.id, patch);
      setAllGeckos((prev) =>
        prev.map((g) => (g.id === editingGecko.id ? { ...g, ...patch } : g))
      );
      setEditingGecko(null);
      toast({ title: 'Listing saved' });
    } catch (error) {
      console.error('Failed to update gecko:', error);
      toast({
        title: 'Save failed',
        description: error.message || 'Try again.',
        variant: 'destructive',
      });
    }
    setIsSaving(false);
  };

  const handleToggleVisible = async (gecko, isVisible) => {
    setTogglingId(gecko.id);
    try {
      await Gecko.update(gecko.id, { is_public: isVisible });
      setAllGeckos((prev) =>
        prev.map((g) => (g.id === gecko.id ? { ...g, is_public: isVisible } : g))
      );
      toast({
        title: isVisible ? 'Listing visible' : 'Listing hidden',
        description: isVisible
          ? `${gecko.name} is back on the marketplace.`
          : `${gecko.name} is hidden from the marketplace.`,
      });
    } catch (err) {
      console.error('Toggle visibility failed:', err);
      toast({ title: 'Could not update', description: err.message, variant: 'destructive' });
    }
    setTogglingId(null);
  };

  const handleUnlist = async (gecko) => {
    if (!confirm(`Remove "${gecko.name}" from the marketplace? You can re-list any time.`)) {
      return;
    }
    try {
      await Gecko.update(gecko.id, { status: 'Pet', is_public: false });
      setAllGeckos((prev) =>
        prev.map((g) =>
          g.id === gecko.id ? { ...g, status: 'Pet', is_public: false } : g
        )
      );
      toast({ title: 'Removed from marketplace' });
    } catch (err) {
      toast({ title: 'Could not unlist', description: err.message, variant: 'destructive' });
    }
  };

  const handleMarkSold = async (gecko) => {
    if (!confirm(`Mark "${gecko.name}" as sold? It will be archived.`)) return;
    try {
      await Gecko.update(gecko.id, {
        status: 'Sold',
        is_public: false,
        archived: true,
        archived_date: new Date().toISOString().split('T')[0],
      });
      setAllGeckos((prev) =>
        prev.map((g) =>
          g.id === gecko.id
            ? { ...g, status: 'Sold', is_public: false, archived: true }
            : g
        )
      );
      toast({ title: 'Marked as sold' });
    } catch (err) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    }
  };

  // Buckets
  const { liveListings, hiddenListings, availableToList, soldCount } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (g) =>
      !q ||
      g.name?.toLowerCase().includes(q) ||
      g.gecko_id_code?.toLowerCase().includes(q) ||
      g.morphs_traits?.toLowerCase().includes(q);

    const live = [];
    const hidden = [];
    const available = [];
    let sold = 0;
    for (const g of allGeckos) {
      if (g.status === 'Sold' || g.archived) {
        sold++;
        continue;
      }
      if (g.status === 'For Sale' && g.is_public !== false) {
        if (matches(g)) live.push(g);
      } else if (g.status === 'For Sale' && g.is_public === false) {
        if (matches(g)) hidden.push(g);
      } else {
        if (matches(g)) available.push(g);
      }
    }
    return {
      liveListings: live,
      hiddenListings: hidden,
      availableToList: available,
      soldCount: sold,
    };
  }, [allGeckos, search]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-100">Seller Console</h1>
            <p className="text-sm text-slate-400 mt-1">
              Manage your marketplace listings. Toggle visibility with one click, update pricing,
              and track your active listings at a glance.
            </p>
          </div>
          <Link to={createPageUrl('MyGeckos')}>
            <Button
              variant="outline"
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              <Plus className="w-4 h-4 mr-2" />
              Manage collection
            </Button>
          </Link>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Live listings" value={liveListings.length} tone="emerald" icon={Eye} />
          <StatCard label="Hidden drafts" value={hiddenListings.length} tone="amber" icon={EyeOff} />
          <StatCard label="Collection" value={availableToList.length} tone="slate" icon={ShoppingBag} />
          <StatCard label="Sold all-time" value={soldCount} tone="slate" icon={CheckCircle2} />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search your geckos by name, ID, or morph..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-700 text-slate-100"
          />
        </div>

        {/* Active Listings */}
        <section>
          <SectionHeader
            title="Active Listings"
            count={liveListings.length}
            description="Visible on the public marketplace right now."
          />
          {liveListings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center">
              <DollarSign className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-300 font-semibold">No active listings yet</p>
              <p className="text-sm text-slate-500 mt-1">
                Click "List" on any gecko below to put it on the marketplace.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {liveListings.map((g) => (
                <ListingCard
                  key={g.id}
                  gecko={g}
                  user={user}
                  onEdit={handleEdit}
                  onToggleVisible={handleToggleVisible}
                  onUnlist={handleUnlist}
                  onMarkSold={handleMarkSold}
                  isToggling={togglingId === g.id}
                />
              ))}
            </div>
          )}
        </section>

        {/* Hidden Drafts */}
        {hiddenListings.length > 0 && (
          <section>
            <SectionHeader
              title="Hidden Drafts"
              count={hiddenListings.length}
              description="Marked For Sale but toggled off the marketplace. One click to republish."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {hiddenListings.map((g) => (
                <ListingCard
                  key={g.id}
                  gecko={g}
                  user={user}
                  onEdit={handleEdit}
                  onToggleVisible={handleToggleVisible}
                  onUnlist={handleUnlist}
                  onMarkSold={handleMarkSold}
                  isToggling={togglingId === g.id}
                />
              ))}
            </div>
          </section>
        )}

        {/* Available to List */}
        <section>
          <SectionHeader
            title="Your Collection"
            count={availableToList.length}
            description="Everything else. Click 'List' to create a new marketplace listing."
          />
          {availableToList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center">
              <Plus className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-300 font-semibold">No other geckos in your collection</p>
              <p className="text-sm text-slate-500 mt-1">Add some geckos to your collection first.</p>
              <Link to={createPageUrl('MyGeckos')} className="inline-block mt-3">
                <Button className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  <Plus className="w-4 h-4 mr-2" /> Add a gecko
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {availableToList.map((g) => (
                <ListingCard
                  key={g.id}
                  gecko={g}
                  user={user}
                  onEdit={handleEdit}
                  onToggleVisible={handleToggleVisible}
                  onUnlist={handleUnlist}
                  onMarkSold={handleMarkSold}
                  isToggling={togglingId === g.id}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editingGecko} onOpenChange={(open) => !open && setEditingGecko(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit listing — {editingGecko?.name}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Update price, description, and visibility. Save to apply instantly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="asking-price" className="text-slate-300">
                  Asking price (USD)
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="asking-price"
                    type="number"
                    min="0"
                    value={formData.asking_price}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, asking_price: e.target.value }))
                    }
                    placeholder="0"
                    className="pl-8 bg-slate-950 border-slate-700 text-slate-100"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="status" className="text-slate-300">
                  Status
                </Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger
                    id="status"
                    className="bg-slate-950 border-slate-700 text-slate-100"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                    {SELLABLE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-4 py-3">
              <div className="min-w-0">
                <Label className="text-slate-200">Visible on marketplace</Label>
                <p className="text-xs text-slate-500 mt-0.5">
                  Off = saved as a hidden draft. You can still edit the listing.
                </p>
              </div>
              <Switch
                checked={formData.is_public}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_public: checked }))
                }
              />
            </div>

            <div>
              <Label htmlFor="marketplace-description" className="text-slate-300">
                Listing description
              </Label>
              <Textarea
                id="marketplace-description"
                value={formData.marketplace_description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    marketplace_description: e.target.value,
                  }))
                }
                placeholder="Lineage notes, highlights, genetics, shipping info..."
                rows={5}
                className="bg-slate-950 border-slate-700 text-slate-100"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingGecko(null)}
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
