import { useCallback, useEffect, useState } from 'react';
import { User } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain, Database, TrendingUp, CheckCircle, Loader2, BarChart3,
  Target, Scale, Upload as UploadIcon, RefreshCw, Sparkles, ShieldCheck,
} from 'lucide-react';

import ExpertContributionForm from '../components/morph-id/ExpertContributionForm';
import AIFeedbackQueue from '../components/morph-id/AIFeedbackQueue';
import {
  PRIMARY_MORPHS, GENETIC_TRAITS, TAXONOMY_VERSION, labelFor,
} from '../components/morph-id/morphTaxonomy';

const TRAINING_GOAL = 10_000;

const EMPTY_STATS = {
  totalImages: 0,
  verifiedImages: 0,
  morphCategories: 0,
  recentSubmissions: 0,
  topMorphs: [],
  coveragePct: 0,
  coveredCount: 0,
  totalCategories: PRIMARY_MORPHS.length,
  avgConfidence: null,
  undersampled: [],
  missingGenetics: [],
};

// Shapes the raw `gecko_image_stats` RPC payload into what the UI renders,
// joining the taxonomy in so labels / missing-trait computation stay on the
// client (cheap, and keeps the SQL side label-agnostic).
function adaptStats(raw) {
  if (!raw) return EMPTY_STATS;

  const top = (raw.top_morphs || []).map((m) => ({
    id: m.id,
    count: Number(m.count) || 0,
    label: labelFor(m.id),
  }));

  const rawUndersampled = new Map(
    (raw.undersampled_morphs || []).map((m) => [m.id, Number(m.count) || 0]),
  );
  // Include canonical morphs with ZERO samples too — the RPC only returns
  // ids that appear in the table at all.
  const undersampled = PRIMARY_MORPHS
    .map((m) => ({ ...m, count: rawUndersampled.get(m.id) ?? 0 }))
    .filter((m) => m.count < 5);

  const covered = PRIMARY_MORPHS.length - undersampled.filter((m) => m.count === 0).length;

  const seen = new Set(raw.seen_genetic_traits || []);
  const missingGenetics = GENETIC_TRAITS.filter((g) => !seen.has(g.id));

  return {
    totalImages: Number(raw.total) || 0,
    verifiedImages: Number(raw.verified) || 0,
    morphCategories: Number(raw.morph_categories_seen) || 0,
    recentSubmissions: Number(raw.recent_week) || 0,
    topMorphs: top,
    coveragePct: Math.round((covered / PRIMARY_MORPHS.length) * 100),
    coveredCount: covered,
    totalCategories: PRIMARY_MORPHS.length,
    avgConfidence: raw.avg_confidence != null ? Number(raw.avg_confidence) : null,
    undersampled,
    missingGenetics,
  };
}

export default function TrainingPage() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [me, statsRes] = await Promise.all([
          User.me().catch(() => null),
          supabase.rpc('gecko_image_stats').then((r) => r.data).catch(() => null),
        ]);
        setUser(me);
        setStats(adaptStats(statsRes));
      } catch (err) {
        console.error('Training data load failed:', err);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [reloadToken]);

  if (!user && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white p-8">
        <Brain className="w-16 h-16 mb-4 text-emerald-500" />
        <h2 className="text-2xl font-bold mb-2">AI Training Center</h2>
        <p className="text-slate-400 mb-6 max-w-md text-center">
          Sign in to contribute expert-graded training data and help review the
          community queue. Your labels directly train the crested-gecko morph
          model.
        </p>
        <Button onClick={() => User.login()} className="bg-emerald-600 hover:bg-emerald-700">
          Sign up / Login
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white p-8">
        <Loader2 className="w-16 h-16 mb-4 text-emerald-500 animate-spin" />
        <h2 className="text-2xl font-bold">Loading AI Training Center…</h2>
        <p className="text-slate-400">Fetching the latest dataset.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-slate-100">AI Training Center</h1>
              <p className="text-slate-400">
                Contribute, review, and benchmark the crested gecko morph model.
                Taxonomy v{TAXONOMY_VERSION}.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={reload}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        <Tabs defaultValue="contribute" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800">
            <TabsTrigger value="contribute" className="data-[state=active]:bg-slate-700">
              <UploadIcon className="w-4 h-4 mr-2" /> Contribute
            </TabsTrigger>
            <TabsTrigger value="review" className="data-[state=active]:bg-slate-700">
              <Scale className="w-4 h-4 mr-2" /> Review queue
            </TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:bg-slate-700">
              <BarChart3 className="w-4 h-4 mr-2" /> Dataset stats
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contribute" className="space-y-4">
            <div className="flex items-start gap-3 text-slate-400 text-sm">
              <Sparkles className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
              <p>
                Label every axis that matters for ML — primary morph, genetic
                traits, descriptive modifiers, base color, pattern intensity,
                fired state, photo quality, and (optionally) lineage. The more
                axes you provide, the more weight the sample carries in training.
              </p>
            </div>
            <ExpertContributionForm onSaved={reload} />
          </TabsContent>

          <TabsContent value="review" className="space-y-4">
            <div className="flex items-start gap-3 text-slate-400 text-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
              <p>
                Approving promotes a sample to <span className="text-emerald-300">verified</span> —
                the flag ML uses to select training-grade rows. Rejecting keeps
                it in the corpus but marks it unreliable, so the model can
                learn from the disagreement too.
              </p>
            </div>
            <AIFeedbackQueue />
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            <StatsGrid stats={stats} />

            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Dataset health
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <DataBar
                  label="Verified / total samples"
                  value={stats.totalImages > 0 ? (stats.verifiedImages / stats.totalImages) * 100 : 0}
                  sub={`${stats.verifiedImages.toLocaleString()} verified of ${stats.totalImages.toLocaleString()} total`}
                  color="bg-gradient-to-r from-emerald-500 to-blue-500"
                />
                <DataBar
                  label={`Morph category coverage (${stats.coveredCount} / ${stats.totalCategories})`}
                  value={stats.coveragePct}
                  sub="% of canonical primary morphs with ≥ 1 labeled sample"
                  color="bg-gradient-to-r from-amber-500 to-pink-500"
                />
                <DataBar
                  label="Distance to training goal"
                  value={Math.min(100, (stats.totalImages / TRAINING_GOAL) * 100)}
                  sub={`${stats.totalImages.toLocaleString()} / ${TRAINING_GOAL.toLocaleString()} images`}
                  color="bg-gradient-to-r from-purple-500 to-blue-500"
                />
                {stats.avgConfidence != null && (
                  <p className="text-sm text-slate-400">
                    Mean contributor confidence:{' '}
                    <span className="text-slate-100 font-semibold">
                      {Math.round(stats.avgConfidence)}%
                    </span>
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-100">Top labeled morphs</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.topMorphs.length === 0 ? (
                  <p className="text-slate-400 text-sm">No labeled samples yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {stats.topMorphs.map((m) => (
                      <li key={m.id} className="flex items-center gap-3">
                        <span className="w-40 text-sm text-slate-200 truncate">
                          {m.label}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500"
                            style={{
                              width: `${Math.min(100, (m.count / stats.topMorphs[0].count) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="w-12 text-right text-sm text-slate-400">{m.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-100">Gap analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400 text-sm mb-3">
                  Canonical primary morphs with fewer than 5 labeled samples:
                </p>
                {stats.undersampled.length === 0 ? (
                  <p className="text-sm text-emerald-300">Nothing under-represented — great coverage.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {stats.undersampled.map((m) => (
                      <Badge key={m.id} variant="secondary" className="bg-amber-900/40 text-amber-200 border border-amber-700/40">
                        {m.label} · {m.count}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-slate-400 text-sm mt-4">
                  Genetic-trait labels currently missing from the corpus:
                </p>
                {stats.missingGenetics.length === 0 ? (
                  <p className="text-sm text-emerald-300">All named genetic traits have representation.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {stats.missingGenetics.map((m) => (
                      <Badge key={m.id} variant="secondary" className="bg-purple-900/30 text-purple-200 border border-purple-700/40">
                        {m.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatsTile({ label, value, icon: Icon, gradient }) {
  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400">{label}</p>
            <p className="text-3xl font-bold text-slate-100 mt-2">{value}</p>
          </div>
          <div className={`p-3 rounded-xl ${gradient} shadow-lg`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatsGrid({ stats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatsTile
        label="Total images"
        value={stats.totalImages.toLocaleString()}
        icon={Database}
        gradient="bg-gradient-to-br from-blue-600 to-purple-600"
      />
      <StatsTile
        label="Verified images"
        value={stats.verifiedImages.toLocaleString()}
        icon={CheckCircle}
        gradient="bg-gradient-to-br from-emerald-600 to-green-600"
      />
      <StatsTile
        label="Morph categories"
        value={stats.morphCategories}
        icon={Target}
        gradient="bg-gradient-to-br from-amber-600 to-orange-600"
      />
      <StatsTile
        label="Submitted this week"
        value={stats.recentSubmissions}
        icon={TrendingUp}
        gradient="bg-gradient-to-br from-pink-600 to-red-600"
      />
    </div>
  );
}

function DataBar({ label, value, sub, color }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-slate-300">{label}</span>
        <span className="text-sm text-slate-400">{Math.round(value)}%</span>
      </div>
      <Progress value={value} className="h-3" colorClassName={color} />
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

