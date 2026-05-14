import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Seo from '@/components/seo/Seo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Search, Settings as SettingsIcon, Clock, Send } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { tierOf, getTierLimits } from '@/lib/tierLimits';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import PostUsageMeter from '@/components/promote/PostUsageMeter';
import PromoteComposer from '@/components/promote/PromoteComposer';
import TrialOfferModal from '@/components/promote/TrialOfferModal';
import ConnectionsModal from '@/components/promote/ConnectionsModal';
import { formatDistanceToNow } from 'date-fns';

// Promote ,  the social media manager page.
//
// Lists the user's geckos sorted by `last_meaningful_change_at` (the
// "Recently changed" sort) so the breeder can post about what's actually
// new with their animals. Click a gecko to open the composer.
//
// At the top: monthly post usage meter + recent published posts log.
export default function PromotePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [geckos, setGeckos] = useState([]);
  const [usage, setUsage] = useState(null);
  const [recentPosts, setRecentPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent_changes'); // recent_changes | name | morph
  const [selectedGecko, setSelectedGecko] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);

  const tier = useMemo(() => tierOf(user), [user]);
  const tierLimits = useMemo(() => getTierLimits(user), [user]);

  const loadEverything = useCallback(async () => {
    if (!user?.email || !user?.auth_user_id) return;
    setLoading(true);
    try {
      // 1. User's geckos (filtered by created_by email; matches existing pattern).
      const { data: geckoRows, error: geckoErr } = await supabase
        .from('geckos')
        .select('*')
        .eq('created_by', user.email)
        .order('last_meaningful_change_at', { ascending: false, nullsFirst: false })
        .limit(200);
      if (geckoErr) throw geckoErr;
      setGeckos(geckoRows || []);

      // 2. This month's usage (or seeded with tier defaults if missing).
      // social_post_usage.user_id is the auth UUID, not the legacy
      // profile id — see AuthContext.buildUser for the distinction.
      const monthKey = new Date().toISOString().slice(0, 7);
      const { data: usageRow } = await supabase
        .from('social_post_usage')
        .select('*')
        .eq('user_id', user.auth_user_id)
        .eq('month_key', monthKey)
        .maybeSingle();

      setUsage(usageRow || {
        posts_included: tierLimits.monthlySocialPosts ?? 1,
        posts_published: 0,
        overage_posts: 0,
        overage_cents: 0,
        api_cents_spent: 0,
        credits_used: 0,
      });

      // 3. Recent published posts (latest 8).
      const { data: postRows } = await supabase
        .from('social_posts')
        .select(`
          id, status, template, gecko_id, published_at, created_date,
          primary_variant_id, voice_preset
        `)
        .eq('created_by_user_id', user.auth_user_id)
        .in('status', ['published', 'draft'])
        .order('updated_date', { ascending: false })
        .limit(8);
      setRecentPosts(postRows || []);
    } catch (e) {
      console.error('Promote load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.email, user?.auth_user_id, tierLimits.monthlySocialPosts]);

  useEffect(() => {
    loadEverything();
  }, [loadEverything]);

  const filteredGeckos = useMemo(() => {
    let list = geckos;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((g) =>
        (g.name || '').toLowerCase().includes(q) ||
        (g.id || '').toLowerCase().includes(q) ||
        (g.morph_description || g.morph || '').toLowerCase().includes(q)
      );
    }
    if (sortBy === 'name') {
      list = [...list].sort((a, b) => (a.name || a.id || '').localeCompare(b.name || b.id || ''));
    } else if (sortBy === 'morph') {
      list = [...list].sort((a, b) => (a.morph_description || a.morph || '').localeCompare(b.morph_description || b.morph || ''));
    }
    return list;
  }, [geckos, search, sortBy]);

  const credits = Number(user?.social_post_credits || 0);

  const handleSelectGecko = (g) => {
    setSelectedGecko(g);
    setComposerOpen(true);
  };

  const handlePaymentRequired = () => {
    setComposerOpen(false);
    setTrialOpen(true);
  };

  const handlePublished = () => {
    loadEverything();
  };

  if (!user?.email) {
    return (
      <div className="p-8 max-w-md mx-auto text-center">
        <h1 className="text-2xl font-bold text-emerald-100 mb-2">Promote</h1>
        <p className="text-emerald-200/80 mb-4">
          Sign in to use the social media manager.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <Seo
        title="Promote your geckos ,  Geck Inspect"
        description="Generate platform-tailored social media posts about your crested geckos using AI trained on crestie-specific best practices."
      />

      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-emerald-100 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-emerald-400" />
            Promote
          </h1>
          <p className="text-sm text-emerald-200/70 mt-1">
            Pick a gecko and we'll draft a post about it. Tailored to platform best practices.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConnectionsOpen(true)}
        >
          <SettingsIcon className="w-4 h-4 mr-1.5" />
          Connections
        </Button>
      </div>

      {/* Usage meter */}
      <div className="mb-5">
        <PostUsageMeter usage={usage} tier={tier} credits={credits} />
      </div>

      {/* Recent posts strip */}
      {recentPosts.length > 0 && (
        <div className="mb-6">
          <div className="text-xs uppercase tracking-wider text-emerald-300 mb-2">Recent</div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {recentPosts.map((p) => (
              <div
                key={p.id}
                className="flex-shrink-0 rounded-md border border-emerald-800/40 bg-emerald-950/30 px-3 py-2 text-xs"
              >
                <div className="font-medium text-emerald-100">{p.template}</div>
                <div className="text-emerald-200/60">
                  {p.status === 'published' ? (
                    <><Send className="inline w-3 h-3 mr-1" />Published</>
                  ) : (
                    <>Draft</>
                  )}
                  {' '}{p.published_at ? formatDistanceToNow(new Date(p.published_at), { addSuffix: true }) : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400/60" />
          <Input
            placeholder="Search geckos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent_changes">Recently changed</SelectItem>
            <SelectItem value="name">Name (A-Z)</SelectItem>
            <SelectItem value="morph">Morph</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort explainer (only on Recently changed) */}
      {sortBy === 'recent_changes' && (
        <div className="text-xs text-emerald-200/60 mb-3 px-1">
          <Clock className="inline w-3 h-3 mr-1" />
          Surfacing geckos with new photos, weights, or pairings first. Audiences follow along
          when they can see the journey, this is a tried and true social media strategy.
        </div>
      )}

      {/* Gecko grid */}
      {loading ? (
        <LoadingSpinner />
      ) : filteredGeckos.length === 0 ? (
        <EmptyState
          title="No geckos to promote yet"
          description="Add geckos to your collection first, then come back here to share them."
          actionLabel="Go to My Geckos"
          onAction={() => navigate('/MyGeckos')}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredGeckos.map((g) => (
            <Card
              key={g.id}
              className="cursor-pointer hover:border-emerald-500/50 transition-colors"
              onClick={() => handleSelectGecko(g)}
            >
              <CardContent className="p-3">
                <div className="aspect-square w-full bg-emerald-950/40 rounded-md mb-2 overflow-hidden flex items-center justify-center">
                  {g.image_urls?.[0] ? (
                    <img
                      src={g.image_urls[0]}
                      alt={g.name || g.id}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-emerald-700 text-xs">no photo</span>
                  )}
                </div>
                <div className="font-semibold text-emerald-100 text-sm truncate">
                  {g.name || g.id}
                </div>
                <div className="text-xs text-emerald-300/70 truncate">
                  {g.morph_description || g.morph || 'unspecified morph'}
                </div>
                {g.last_meaningful_change_at && (
                  <div className="text-[10px] text-emerald-200/50 mt-1">
                    Updated {formatDistanceToNow(new Date(g.last_meaningful_change_at), { addSuffix: true })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PromoteComposer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        gecko={selectedGecko}
        user={user}
        onPublished={handlePublished}
        onPaymentRequired={handlePaymentRequired}
      />

      <TrialOfferModal
        open={trialOpen}
        onOpenChange={setTrialOpen}
        tier={tier}
        trialAlreadyUsed={user?.keeper_trial_used}
      />

      <ConnectionsModal
        open={connectionsOpen}
        onOpenChange={setConnectionsOpen}
        user={user}
      />
    </div>
  );
}
