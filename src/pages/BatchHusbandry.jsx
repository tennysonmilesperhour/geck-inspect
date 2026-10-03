import { useState, useEffect, useCallback } from 'react';
import { User, FeedingGroup, FeedingRecord, WeightRecord, Gecko } from '@/entities/all';
import { format, differenceInCalendarDays } from 'date-fns';
import { todayLocalISO, parseLocalDate } from '@/lib/dateUtils';
import { logFeedings } from '@/lib/husbandryLog';
import {
  Utensils, Scale, ChevronLeft, CheckCircle2, AlertTriangle, Loader2,
  Clock, Users, X, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';

/* ─── Helpers ───────────────────────────────────────────────────── */

function daysSinceColor(days) {
  if (days <= 3) return 'text-emerald-400';
  if (days <= 7) return 'text-amber-400';
  return 'text-red-400';
}

function SectionHeading({ children }) {
  return (
    <h2 className="text-xl font-semibold text-slate-100 mb-4">
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

    // parseLocalDate: new Date('YYYY-MM-DD') is UTC midnight, so after 5 pm
    // in California a gecko fed today read as fed yesterday.
    const lastDate = lastFeed ? parseLocalDate(lastFeed.date || lastFeed.created_date) : null;
    const daysSince = lastDate ? differenceInCalendarDays(now, lastDate) : 999;
    if (daysSince >= (group.interval_days || 3)) {
      dueCount++;
    }
  }

  return (
    <div className="rounded-xl p-4 md:p-6 bg-slate-900 border border-slate-700">
      <div className="flex items-start gap-3 mb-4">
        {/* Group colors come from data; the fallback matches the theme. */}
        <div
          className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${group.color ? '' : 'bg-emerald-500'}`}
          style={group.color ? { backgroundColor: group.color } : undefined}
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold truncate text-slate-100">
            {group.name || group.label || 'Unnamed Group'}
          </h3>
          {group.diet_type && (
            <p className="text-xs text-slate-500">{group.diet_type}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10">
          <Users size={14} className="text-emerald-400" />
          <span className="text-sm text-slate-200">
            <strong>{groupGeckos.length}</strong> animals
          </span>
        </div>
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg ${dueCount > 0 ? 'bg-amber-500/15' : 'bg-emerald-500/10'}`}
        >
          <Clock size={14} className={dueCount > 0 ? 'text-amber-400' : 'text-emerald-400'} />
          <span className={`text-sm ${dueCount > 0 ? 'text-amber-300' : 'text-slate-200'}`}>
            <strong>{dueCount}</strong> due today
          </span>
        </div>
      </div>

      {group.notes && (
        <p className="text-xs mb-4 text-slate-500">{group.notes}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => onFeed(group, groupGeckos)}
          className="flex-1 text-xs"
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
    // parseLocalDate: new Date('YYYY-MM-DD') is UTC midnight, so after 5 pm
    // in California a gecko fed today read as fed yesterday.
    const lastDate = lastFeed ? parseLocalDate(lastFeed.date || lastFeed.created_date) : null;
    const daysSince = lastDate ? differenceInCalendarDays(now, lastDate) : 999;
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
      const today = todayLocalISO();
      let fedCount = 0;
      let refusedCount = 0;

      const entries = rows.map((row) => {
        const accepted = statuses[row.gecko.id] === 'fed';
        if (accepted) fedCount++; else refusedCount++;
        return {
          // Geckos matched by the old label field still belong to this group.
          gecko: { ...row.gecko, feeding_group_id: group.id },
          accepted,
          notes: accepted ? null : 'Refused during batch feeding',
        };
      });

      // One feeding row per gecko, and the group's last fed date (read by
      // the reminder job, the Dashboard and Project Manager) moves when at
      // least one ate (D21). Same log every other surface uses.
      await logFeedings({
        entries,
        date: today,
        foodType: group.diet_type || 'CGD',
        groups: [group],
      });

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
        <div className="rounded-xl p-6 md:p-8 text-center bg-slate-900 border border-slate-700">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-emerald-500/10">
            <CheckCircle2 size={32} className="text-emerald-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2 text-slate-100">
            Batch Feeding Complete
          </h3>
          <p className="text-sm mb-6 text-slate-500">
            {group.name || group.label}, {format(new Date(), 'MMMM d, yyyy')}
          </p>
          <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto mb-6">
            <div className="rounded-xl p-4 bg-emerald-500/10">
              <p className="text-2xl font-bold text-emerald-400">{summary.fed}</p>
              <p className="text-xs text-slate-500">Fed</p>
            </div>
            <div
              className={`rounded-xl p-4 ${summary.refused > 0 ? 'bg-amber-500/15' : 'bg-emerald-500/10'}`}
            >
              <p className={`text-2xl font-bold ${summary.refused > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {summary.refused}
              </p>
              <p className="text-xs text-slate-500">Refused</p>
            </div>
          </div>
          <Button onClick={onBack}>
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
        className="touch:min-h-11 flex items-center gap-1.5 text-sm mb-4 hover:underline text-emerald-400"
      >
        <ChevronLeft size={16} /> Back to Groups
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <SectionHeading>
            Feed: {group.name || group.label}
          </SectionHeading>
          <p className="text-sm -mt-2 text-slate-500">
            {rows.length} animals, sorted by most overdue
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={markAllFed}
          className="text-xs"
        >
          <Check size={14} className="mr-1" /> Mark All Fed
        </Button>
      </div>

      <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-700 divide-y divide-slate-800">
        {rows.map((row) => (
          <div
            key={row.gecko.id}
            className="flex items-center gap-3 px-4 py-3"
          >
            {/* Gecko name */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-slate-200">
                {row.gecko.name || row.gecko.id}
              </p>
              {row.gecko.morphs_traits && (
                <p className="text-xs truncate text-slate-500">{row.gecko.morphs_traits}</p>
              )}
            </div>

            {/* Days since last fed */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Clock size={12} className={daysSinceColor(row.daysSince)} />
              <span className={`text-xs font-medium ${daysSinceColor(row.daysSince)}`}>
                {row.daysSince >= 999 ? 'Never' : `${row.daysSince}d ago`}
              </span>
            </div>

            {/* Fed / Refused toggle */}
            <button
              onClick={() => toggleStatus(row.gecko.id)}
              className={`touch:min-h-11 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex-shrink-0 ${
                statuses[row.gecko.id] === 'fed'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-amber-500/15 text-amber-300'
              }`}
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
    // weight_records uses gecko_id / record_date / weight_grams (feeding_records
    // is the table with animal_id / date, which this used to copy by mistake).
    const lastWeightRec = weightRecords
      .filter(r => r.gecko_id === gecko.id)
      .sort((a, b) => new Date(b.record_date || b.created_date) - new Date(a.record_date || a.created_date))[0];
    const lastWeight = lastWeightRec ? parseFloat(lastWeightRec.weight_grams) : null;
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
      const today = todayLocalISO();
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
          gecko_id: row.gecko.id,
          record_date: today,
          weight_grams: newWeight,
          notes: `Batch weigh, ${group.name || group.label}`,
        });
        // Keep the card weight in step with the newest weigh-in.
        await Gecko.update(row.gecko.id, { weight_grams: newWeight });
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
        <div className="rounded-xl p-6 md:p-8 text-center bg-slate-900 border border-slate-700">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-emerald-500/10">
            <Scale size={32} className="text-emerald-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2 text-slate-100">
            Batch Weigh Complete
          </h3>
          <p className="text-sm mb-6 text-slate-500">
            {group.name || group.label}, {format(new Date(), 'MMMM d, yyyy')}
          </p>
          <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto mb-6">
            <div className="rounded-xl p-4 bg-emerald-500/10">
              <p className="text-2xl font-bold text-emerald-400">{summaryData.recorded}</p>
              <p className="text-xs text-slate-500">Recorded</p>
            </div>
            <div
              className={`rounded-xl p-4 ${summaryData.flagged > 0 ? 'bg-amber-500/15' : 'bg-emerald-500/10'}`}
            >
              <p className={`text-2xl font-bold ${summaryData.flagged > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {summaryData.flagged}
              </p>
              <p className="text-xs text-slate-500">Flagged (&gt;10% drop)</p>
            </div>
          </div>
          <Button onClick={onBack}>
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
        className="touch:min-h-11 flex items-center gap-1.5 text-sm mb-4 hover:underline text-emerald-400"
      >
        <ChevronLeft size={16} /> Back to Groups
      </button>

      <SectionHeading>
        Weigh: {group.name || group.label}
      </SectionHeading>
      <p className="text-sm -mt-2 mb-4 text-slate-500">
        {rows.length} animals, enter new weights in grams
      </p>

      <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-700 divide-y divide-slate-800">
        {/* Header */}
        <div className="grid grid-cols-3 gap-2 px-4 py-2.5 text-xs font-medium uppercase tracking-wider bg-emerald-500/10 text-slate-500">
          <span>Animal</span>
          <span className="text-right">Last Weight (g)</span>
          <span className="text-right">New Weight (g)</span>
        </div>

        {rows.map((row) => {
          const newVal = weights[row.gecko.id];
          const newWeight = newVal ? parseFloat(newVal) : null;
          const hasSignificantDrop = row.lastWeight && newWeight && newWeight < row.lastWeight * 0.9;

          return (
            <div
              key={row.gecko.id}
              className={`grid grid-cols-3 gap-2 px-4 py-3 items-center ${hasSignificantDrop ? 'bg-amber-500/10' : ''}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate text-slate-200">
                  {row.gecko.name || row.gecko.id}
                </p>
              </div>
              <div className="text-right">
                <span className="text-sm text-slate-500">
                  {row.lastWeight != null ? `${row.lastWeight}g` : '-'}
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
                  className={`w-20 sm:w-24 text-right text-sm ${hasSignificantDrop ? 'border-amber-400' : ''}`}
                />
                {hasSignificantDrop && (
                  <AlertTriangle size={14} className="flex-shrink-0 text-amber-400" />
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
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-emerald-500/10">
        <Users size={28} className="text-emerald-400" />
      </div>
      <h3 className="text-lg font-semibold mb-1 text-slate-100">
        No feeding groups yet
      </h3>
      <p className="text-sm max-w-sm text-slate-500">
        Create feeding groups to organize batch feeding and weighing sessions for your geckos.
      </p>
      <Button asChild className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white min-h-11">
        <Link to="/ProjectManager?tab=feeding">Create a feeding group</Link>
      </Button>
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

  const loadData = useCallback(async (background = false) => {
    // A background reload (after a save) must not swap the page for the
    // spinner: that unmounted the feed view and threw away its summary.
    if (!background) setIsLoading(true);
    try {
      const currentUser = await User.me();
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      const email = currentUser.email;
      const { getVisibleGeckos } = await import('@/lib/geckoAccess');

      const [userGroups, userGeckos, userFeedings, userWeights] = await Promise.all([
        FeedingGroup.filter({ created_by: email }),
        getVisibleGeckos(currentUser),
        FeedingRecord.filter({ created_by: email }, '-date'),
        WeightRecord.filter({ created_by: email }, '-record_date'),
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
    loadData(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 md:p-8">
        <div className="max-w-4xl mx-auto flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-emerald-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {view === 'groups' && (
          <>
            <PageHeader
              icon={Utensils}
              title="Batch Husbandry"
              description="Feed and weigh gecko groups in bulk. Keeps everyone on schedule."
            />

            {/* Summary bar */}
            {groups.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="rounded-xl p-4 text-center bg-slate-900 border border-slate-700">
                  <p className="text-2xl font-bold text-slate-100">{groups.length}</p>
                  <p className="text-xs text-slate-500">Groups</p>
                </div>
                <div className="rounded-xl p-4 text-center bg-slate-900 border border-slate-700">
                  <p className="text-2xl font-bold text-emerald-400">{geckos.length}</p>
                  <p className="text-xs text-slate-500">Total Animals</p>
                </div>
                <div className="rounded-xl p-4 text-center bg-slate-900 border border-slate-700">
                  <p className="text-2xl font-bold text-amber-400">
                    {feedingRecords.filter(r => {
                      const d = r.date || r.created_date;
                      return d && d.startsWith(todayLocalISO());
                    }).length}
                  </p>
                  <p className="text-xs text-slate-500">Fed Today</p>
                </div>
              </div>
            )}

            {/* Group cards */}
            {groups.length === 0 ? (
              <EmptyGroups />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
