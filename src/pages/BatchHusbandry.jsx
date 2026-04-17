import { useState, useEffect, useCallback } from 'react';
import { User, Gecko, FeedingGroup, FeedingRecord, WeightRecord } from '@/entities/all';
import { format, differenceInDays } from 'date-fns';
import {
  Utensils, Scale, ChevronLeft, CheckCircle2, AlertTriangle, Loader2,
  Clock, Users, X, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

/* ─── Design tokens ─────────────────────────────────────────────── */
const C = {
  forest:    '#e2e8f0',
  moss:      '#94a3b8',
  sage:      '#10b981',
  paleSage:  'rgba(16,185,129,0.1)',
  warmWhite: '#020617',
  gold:      '#f59e0b',
  goldLight: 'rgba(245,158,11,0.15)',
  red:       '#ef4444',
  slate:     '#cbd5e1',
  muted:     '#64748b',
  cardBg:    '#0f172a',
  border:    'rgba(51,65,85,0.5)',
};

/* ─── Helpers ───────────────────────────────────────────────────── */

function daysSinceColor(days) {
  if (days <= 3) return C.sage;
  if (days <= 7) return C.gold;
  return C.red;
}

function SectionHeading({ children }) {
  return (
    <h2
      className="text-xl mb-4"
      style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}
    >
      {children}
    </h2>
  );
}

/* ─── Group card ────────────────────────────────────────────────── */

function GroupCard({ group, geckos, feedingRecords, onFeed, onWeigh }) {
  // Compute animals in this group
  // feeding_groups table contains a list; geckos belong via gecko.feeding_group_id or we use the group label
  // For now, match geckos whose feeding_group matches this group's id or label
  const groupGeckos = geckos.filter(
    g => g.feeding_group_id === group.id || g.feeding_group === group.label || g.feeding_group === group.name
  );

  // Compute which are due: interval_days since last feeding
  const now = new Date();
  let dueCount = 0;

  for (const gecko of groupGeckos) {
    const lastFeed = feedingRecords
      .filter(r => r.animal_id === gecko.id)
      .sort((a, b) => new Date(b.date || b.created_date) - new Date(a.date || a.created_date))[0];

    const lastDate = lastFeed ? new Date(lastFeed.date || lastFeed.created_date) : null;
    const daysSince = lastDate ? differenceInDays(now, lastDate) : 999;
    if (daysSince >= (group.interval_days || 3)) {
      dueCount++;
    }
  }

  const colorIndicator = group.color || C.sage;

  return (
    <div
      className="rounded-xl p-5"
      style={{ border: '1px solid rgba(51,65,85,0.15)', backgroundColor: '#fff' }}
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
          style={{ backgroundColor: colorIndicator }}
        />
        <div className="flex-1 min-w-0">
          <h3
            className="text-base font-semibold truncate"
            style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}
          >
            {group.name || group.label || 'Unnamed Group'}
          </h3>
          {group.diet_type && (
            <p className="text-xs" style={{ color: C.muted }}>{group.diet_type}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: C.paleSage }}>
          <Users size={14} style={{ color: C.sage }} />
          <span className="text-sm" style={{ color: C.slate }}>
            <strong>{groupGeckos.length}</strong> animals
          </span>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            backgroundColor: dueCount > 0 ? C.goldLight : C.paleSage,
          }}
        >
          <Clock size={14} style={{ color: dueCount > 0 ? C.gold : C.sage }} />
          <span className="text-sm" style={{ color: dueCount > 0 ? '#92650A' : C.slate }}>
            <strong>{dueCount}</strong> due today
          </span>
        </div>
      </div>

      {group.notes && (
        <p className="text-xs mb-4" style={{ color: C.muted }}>{group.notes}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => onFeed(group, groupGeckos)}
          className="flex-1 text-xs"
          style={{ backgroundColor: C.sage, color: '#fff' }}
          disabled={groupGeckos.length === 0}
        >
          <Utensils size={14} className="mr-1.5" />
          Feed Group
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onWeigh(group, groupGeckos)}
          className="flex-1 text-xs"
          style={{ borderColor: 'rgba(51,65,85,0.3)', color: C.slate }}
          disabled={groupGeckos.length === 0}
        >
          <Scale size={14} className="mr-1.5" />
          Weigh Group
        </Button>
      </div>
    </div>
  );
}

/* ─── Batch Feed View ───────────────────────────────────────────── */

function BatchFeedView({ group, groupGeckos, feedingRecords, onBack, onSaved }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState({ fed: 0, refused: 0 });

  const now = new Date();

  // Build rows sorted by most overdue
  const rows = groupGeckos.map(gecko => {
    const lastFeed = feedingRecords
      .filter(r => r.animal_id === gecko.id)
      .sort((a, b) => new Date(b.date || b.created_date) - new Date(a.date || a.created_date))[0];
    const lastDate = lastFeed ? new Date(lastFeed.date || lastFeed.created_date) : null;
    const daysSince = lastDate ? differenceInDays(now, lastDate) : 999;
    return { gecko, daysSince, lastDate };
  }).sort((a, b) => b.daysSince - a.daysSince);

  // Track fed/refused per gecko
  const [statuses, setStatuses] = useState(() => {
    const initial = {};
    rows.forEach(r => { initial[r.gecko.id] = 'fed'; });
    return initial;
  });

  const toggleStatus = (geckoId) => {
    setStatuses(prev => ({
      ...prev,
      [geckoId]: prev[geckoId] === 'fed' ? 'refused' : 'fed',
    }));
  };

  const markAllFed = () => {
    const all = {};
    rows.forEach(r => { all[r.gecko.id] = 'fed'; });
    setStatuses(all);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      let fedCount = 0;
      let refusedCount = 0;

      for (const row of rows) {
        const accepted = statuses[row.gecko.id] === 'fed';
        if (accepted) fedCount++; else refusedCount++;

        await FeedingRecord.create({
          animal_id: row.gecko.id,
          date: today,
          food_type: group.diet_type || 'CGD',
          accepted,
          notes: accepted ? null : 'Refused during batch feeding',
        });
      }

      setSummary({ fed: fedCount, refused: refusedCount });
      setShowSummary(true);
      toast({ title: 'Feeding recorded', description: `${fedCount} fed, ${refusedCount} refused` });
      onSaved();
    } catch (err) {
      toast({ title: 'Error saving', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (showSummary) {
    return (
      <div className="max-w-2xl mx-auto">
        <div
          className="rounded-xl p-8 text-center"
          style={{ border: '1px solid rgba(51,65,85,0.15)', backgroundColor: '#fff' }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: C.paleSage }}
          >
            <CheckCircle2 size={32} style={{ color: C.sage }} />
          </div>
          <h3
            className="text-xl mb-2"
            style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}
          >
            Batch Feeding Complete
          </h3>
          <p className="text-sm mb-6" style={{ color: C.muted }}>
            {group.name || group.label} — {format(new Date(), 'MMMM d, yyyy')}
          </p>
          <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto mb-6">
            <div className="rounded-xl p-4" style={{ backgroundColor: C.paleSage }}>
              <p className="text-2xl font-bold" style={{ color: C.sage }}>{summary.fed}</p>
              <p className="text-xs" style={{ color: C.muted }}>Fed</p>
            </div>
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: summary.refused > 0 ? C.goldLight : C.paleSage }}
            >
              <p className="text-2xl font-bold" style={{ color: summary.refused > 0 ? C.gold : C.sage }}>
                {summary.refused}
              </p>
              <p className="text-xs" style={{ color: C.muted }}>Refused</p>
            </div>
          </div>
          <Button
            onClick={onBack}
            style={{ backgroundColor: C.sage, color: '#fff' }}
          >
            Back to Groups
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm mb-4 hover:underline"
        style={{ color: C.sage }}
      >
        <ChevronLeft size={16} /> Back to Groups
      </button>

      <div className="flex items-center justify-between mb-4">
        <div>
          <SectionHeading>
            Feed: {group.name || group.label}
          </SectionHeading>
          <p className="text-sm -mt-2" style={{ color: C.muted }}>
            {rows.length} animals — sorted by most overdue
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={markAllFed}
          className="text-xs"
          style={{ borderColor: 'rgba(51,65,85,0.3)', color: C.sage }}
        >
          <Check size={14} className="mr-1" /> Mark All Fed
        </Button>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(51,65,85,0.15)', backgroundColor: '#fff' }}
      >
        {rows.map((row, idx) => (
          <div
            key={row.gecko.id}
            className="flex items-center gap-3 px-4 py-3"
            style={{
              borderBottom: idx < rows.length - 1 ? '1px solid rgba(51,65,85,0.08)' : 'none',
            }}
          >
            {/* Gecko name */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: C.slate }}>
                {row.gecko.name || row.gecko.id}
              </p>
              {row.gecko.morph && (
                <p className="text-xs truncate" style={{ color: C.muted }}>{row.gecko.morph}</p>
              )}
            </div>

            {/* Days since last fed */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Clock size={12} style={{ color: daysSinceColor(row.daysSince) }} />
              <span
                className="text-xs font-medium"
                style={{ color: daysSinceColor(row.daysSince) }}
              >
                {row.daysSince >= 999 ? 'Never' : `${row.daysSince}d ago`}
              </span>
            </div>

            {/* Fed / Refused toggle */}
            <button
              onClick={() => toggleStatus(row.gecko.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex-shrink-0"
              style={{
                backgroundColor: statuses[row.gecko.id] === 'fed' ? C.paleSage : C.goldLight,
                color: statuses[row.gecko.id] === 'fed' ? C.sage : '#92650A',
              }}
            >
              {statuses[row.gecko.id] === 'fed' ? (
                <><Check size={12} /> Fed</>
              ) : (
                <><X size={12} /> Refused</>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-end mt-4">
        <Button
          onClick={handleSave}
          disabled={saving}
          style={{ backgroundColor: C.sage, color: '#fff' }}
        >
          {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Utensils size={16} className="mr-2" />}
          Save Feeding Records
        </Button>
      </div>
    </div>
  );
}

/* ─── Batch Weigh View ──────────────────────────────────────────── */

function BatchWeighView({ group, groupGeckos, weightRecords, onBack, onSaved }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState({ recorded: 0, flagged: 0 });

  // Build rows with last weight
  const rows = groupGeckos.map(gecko => {
    const lastWeightRec = weightRecords
      .filter(r => r.animal_id === gecko.id)
      .sort((a, b) => new Date(b.date || b.created_date) - new Date(a.date || a.created_date))[0];
    const lastWeight = lastWeightRec ? parseFloat(lastWeightRec.weight) : null;
    return { gecko, lastWeight };
  });

  const [weights, setWeights] = useState(() => {
    const initial = {};
    rows.forEach(r => { initial[r.gecko.id] = ''; });
    return initial;
  });

  const setWeight = (geckoId, val) => {
    setWeights(prev => ({ ...prev, [geckoId]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      let recorded = 0;
      let flagged = 0;

      for (const row of rows) {
        const newVal = weights[row.gecko.id];
        if (!newVal || isNaN(parseFloat(newVal))) continue;

        const newWeight = parseFloat(newVal);
        recorded++;

        // Check for >10% drop
        if (row.lastWeight && newWeight < row.lastWeight * 0.9) {
          flagged++;
        }

        await WeightRecord.create({
          animal_id: row.gecko.id,
          date: today,
          weight: newWeight,
          notes: `Batch weigh — ${group.name || group.label}`,
        });
      }

      setSummaryData({ recorded, flagged });
      setShowSummary(true);
      toast({ title: 'Weights recorded', description: `${recorded} recorded, ${flagged} flagged` });
      onSaved();
    } catch (err) {
      toast({ title: 'Error saving', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (showSummary) {
    return (
      <div className="max-w-2xl mx-auto">
        <div
          className="rounded-xl p-8 text-center"
          style={{ border: '1px solid rgba(51,65,85,0.15)', backgroundColor: '#fff' }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: C.paleSage }}
          >
            <Scale size={32} style={{ color: C.sage }} />
          </div>
          <h3
            className="text-xl mb-2"
            style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}
          >
            Batch Weigh Complete
          </h3>
          <p className="text-sm mb-6" style={{ color: C.muted }}>
            {group.name || group.label} — {format(new Date(), 'MMMM d, yyyy')}
          </p>
          <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto mb-6">
            <div className="rounded-xl p-4" style={{ backgroundColor: C.paleSage }}>
              <p className="text-2xl font-bold" style={{ color: C.sage }}>{summaryData.recorded}</p>
              <p className="text-xs" style={{ color: C.muted }}>Recorded</p>
            </div>
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: summaryData.flagged > 0 ? C.goldLight : C.paleSage }}
            >
              <p className="text-2xl font-bold" style={{ color: summaryData.flagged > 0 ? C.gold : C.sage }}>
                {summaryData.flagged}
              </p>
              <p className="text-xs" style={{ color: C.muted }}>Flagged (&gt;10% drop)</p>
            </div>
          </div>
          <Button
            onClick={onBack}
            style={{ backgroundColor: C.sage, color: '#fff' }}
          >
            Back to Groups
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm mb-4 hover:underline"
        style={{ color: C.sage }}
      >
        <ChevronLeft size={16} /> Back to Groups
      </button>

      <SectionHeading>
        Weigh: {group.name || group.label}
      </SectionHeading>
      <p className="text-sm -mt-2 mb-4" style={{ color: C.muted }}>
        {rows.length} animals — enter new weights in grams
      </p>

      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(51,65,85,0.15)', backgroundColor: '#fff' }}
      >
        {/* Header */}
        <div
          className="grid grid-cols-3 gap-2 px-4 py-2.5 text-xs font-medium uppercase tracking-wider"
          style={{ backgroundColor: C.paleSage, color: C.muted }}
        >
          <span>Animal</span>
          <span className="text-right">Last Weight (g)</span>
          <span className="text-right">New Weight (g)</span>
        </div>

        {rows.map((row, idx) => {
          const newVal = weights[row.gecko.id];
          const newWeight = newVal ? parseFloat(newVal) : null;
          const hasSignificantDrop = row.lastWeight && newWeight && newWeight < row.lastWeight * 0.9;

          return (
            <div
              key={row.gecko.id}
              className="grid grid-cols-3 gap-2 px-4 py-3 items-center"
              style={{
                borderBottom: idx < rows.length - 1 ? '1px solid rgba(51,65,85,0.08)' : 'none',
                backgroundColor: hasSignificantDrop ? 'rgba(253,243,224,0.4)' : 'transparent',
              }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: C.slate }}>
                  {row.gecko.name || row.gecko.id}
                </p>
              </div>
              <div className="text-right">
                <span className="text-sm" style={{ color: C.muted }}>
                  {row.lastWeight != null ? `${row.lastWeight}g` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-end gap-1">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={weights[row.gecko.id]}
                  onChange={e => setWeight(row.gecko.id, e.target.value)}
                  placeholder="0.0"
                  className="w-24 text-right text-sm"
                  style={hasSignificantDrop ? { borderColor: C.gold } : {}}
                />
                {hasSignificantDrop && (
                  <AlertTriangle size={14} style={{ color: C.gold }} className="flex-shrink-0" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end mt-4">
        <Button
          onClick={handleSave}
          disabled={saving}
          style={{ backgroundColor: C.sage, color: '#fff' }}
        >
          {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Scale size={16} className="mr-2" />}
          Save Weights
        </Button>
      </div>
    </div>
  );
}

/* ─── Empty state ───────────────────────────────────────────────── */

function EmptyGroups() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: C.paleSage }}
      >
        <Users size={28} style={{ color: C.sage }} />
      </div>
      <h3 className="text-lg font-medium mb-1" style={{ color: C.forest, fontFamily: "'DM Serif Display', serif" }}>
        No feeding groups yet
      </h3>
      <p className="text-sm max-w-sm" style={{ color: C.muted }}>
        Create feeding groups to organize batch feeding and weighing sessions for your geckos.
      </p>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────── */

export default function BatchHusbandry() {
  const [groups, setGroups] = useState([]);
  const [geckos, setGeckos] = useState([]);
  const [feedingRecords, setFeedingRecords] = useState([]);
  const [weightRecords, setWeightRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // View states: 'groups' | 'feed' | 'weigh'
  const [view, setView] = useState('groups');
  const [activeGroup, setActiveGroup] = useState(null);
  const [activeGeckos, setActiveGeckos] = useState([]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      const email = currentUser.email;

      const [userGroups, userGeckos, userFeedings, userWeights] = await Promise.all([
        FeedingGroup.filter({ created_by: email }),
        Gecko.filter({ created_by: email }),
        FeedingRecord.filter({ created_by: email }, '-date'),
        WeightRecord.filter({ created_by: email }, '-date'),
      ]);

      setGroups(userGroups);
      setGeckos(userGeckos.filter(g => !g.archived));
      setFeedingRecords(userFeedings);
      setWeightRecords(userWeights);
    } catch (err) {
      console.error('Failed to load batch husbandry data:', err);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFeed = (group, groupGeckos) => {
    setActiveGroup(group);
    setActiveGeckos(groupGeckos);
    setView('feed');
  };

  const handleWeigh = (group, groupGeckos) => {
    setActiveGroup(group);
    setActiveGeckos(groupGeckos);
    setView('weigh');
  };

  const handleBack = () => {
    setView('groups');
    setActiveGroup(null);
    setActiveGeckos([]);
  };

  const handleSaved = () => {
    // Reload data in background
    loadData();
  };

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: C.warmWhite, fontFamily: "'DM Sans', sans-serif" }}
      >
        <Loader2 size={32} className="animate-spin" style={{ color: C.sage }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-12"
      style={{ backgroundColor: C.warmWhite, fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="max-w-4xl mx-auto px-4 pt-8 pb-6">
        {view === 'groups' && (
          <>
            {/* Header */}
            <div className="mb-6">
              <h1
                className="text-2xl mb-1"
                style={{ fontFamily: "'DM Serif Display', serif", color: C.forest }}
              >
                Batch Husbandry
              </h1>
              <p className="text-sm" style={{ color: C.muted }}>
                Feed and weigh gecko groups in bulk. Keeps everyone on schedule.
              </p>
            </div>

            {/* Summary bar */}
            {groups.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div
                  className="rounded-xl p-4 text-center"
                  style={{ border: '1px solid rgba(51,65,85,0.15)', backgroundColor: '#fff' }}
                >
                  <p className="text-2xl font-bold" style={{ color: C.forest }}>{groups.length}</p>
                  <p className="text-xs" style={{ color: C.muted }}>Groups</p>
                </div>
                <div
                  className="rounded-xl p-4 text-center"
                  style={{ border: '1px solid rgba(51,65,85,0.15)', backgroundColor: '#fff' }}
                >
                  <p className="text-2xl font-bold" style={{ color: C.sage }}>{geckos.length}</p>
                  <p className="text-xs" style={{ color: C.muted }}>Total Animals</p>
                </div>
                <div
                  className="rounded-xl p-4 text-center"
                  style={{ border: '1px solid rgba(51,65,85,0.15)', backgroundColor: '#fff' }}
                >
                  <p className="text-2xl font-bold" style={{ color: C.gold }}>
                    {feedingRecords.filter(r => {
                      const d = r.date || r.created_date;
                      return d && d.startsWith(new Date().toISOString().split('T')[0]);
                    }).length}
                  </p>
                  <p className="text-xs" style={{ color: C.muted }}>Fed Today</p>
                </div>
              </div>
            )}

            {/* Group cards */}
            {groups.length === 0 ? (
              <EmptyGroups />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {groups.map(group => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    geckos={geckos}
                    feedingRecords={feedingRecords}
                    onFeed={handleFeed}
                    onWeigh={handleWeigh}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {view === 'feed' && activeGroup && (
          <BatchFeedView
            group={activeGroup}
            groupGeckos={activeGeckos}
            feedingRecords={feedingRecords}
            onBack={handleBack}
            onSaved={handleSaved}
          />
        )}

        {view === 'weigh' && activeGroup && (
          <BatchWeighView
            group={activeGroup}
            groupGeckos={activeGeckos}
            weightRecords={weightRecords}
            onBack={handleBack}
            onSaved={handleSaved}
          />
        )}
      </div>
    </div>
  );
}
