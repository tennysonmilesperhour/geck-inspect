import GeckoImage from '@/components/shared/GeckoImage';
import { useEffect, useImperativeHandle, useMemo, useState, forwardRef } from 'react';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';
import { FutureBreedingPlan, BreedingPlan, User } from '@/entities/all';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { checkPlanLimit } from '@/components/subscription/PlanLimitChecker';
import { buildPlanFromFuturePlan } from '@/lib/seasons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  Trash2,
  Edit,
  Calendar as CalendarIcon,
  Bell,
  Dna,
  Sparkles,
  Loader2,
  AlertCircle,
  PlayCircle,
} from 'lucide-react';
import GeneticCalculator from '@/components/breeding/GeneticCalculator';
import {
  computeSeasonWindow,
  seasonStatus,
  SEASONS,
  SEASON_LABELS,
} from '@/lib/seasons';

/**
 * Future breeding plans
 *
 * A planning surface for pairings you want to kick off in a future
 * season + year. Stores the planned season, year, sire, dam, goals, and
 * notes; shows genetic outcome probabilities from GeneticCalculator.
 * The server sends a notification when the target season's window opens
 * (enqueue_season_planner_reminders, daily), with the app closed or open.
 * "Start this pairing" turns the plan into a real breeding plan.
 *
 * Entity: FutureBreedingPlan (future_breeding_plans table)
 */

const YEAR_OPTIONS = Array.from(
  { length: 8 },
  (_, i) => new Date().getFullYear() + i
);

// Parent thumbnail card used inside FutureBreedingPlan cards. Shows
// the gecko's first photo (or a fallback), a ♂/♀ sex chip, and the
// name underneath. Dim/outlined when the parent is missing from the
// user's collection.
function ParentPortrait({ gecko, role }) {
  const isSire = role === 'sire';
  const img = gecko?.image_urls?.[0] || DEFAULT_GECKO_IMAGE;
  const roleTint = isSire
    ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
    : 'bg-pink-500/15 text-pink-300 border-pink-500/30';
  const sexGlyph = isSire ? '♂' : '♀';
  return (
    <div className="flex flex-col items-center min-w-0">
      <div
        className={`relative w-full aspect-square rounded-lg overflow-hidden border ${
          gecko ? 'border-slate-700 bg-slate-800' : 'border-dashed border-slate-700 bg-slate-800/40 opacity-70'
        }`}
      >
        <GeckoImage
          src={img}
          alt={gecko?.name || (isSire ? 'Unknown sire' : 'Unknown dam')}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = DEFAULT_GECKO_IMAGE;
          }}
        />
        <span
          className={`absolute top-1 left-1 text-xs font-bold rounded-full border w-5 h-5 flex items-center justify-center ${roleTint}`}
          title={isSire ? 'Sire' : 'Dam'}
        >
          {sexGlyph}
        </span>
      </div>
      <p className="text-xs text-slate-200 font-semibold mt-1.5 truncate w-full text-center">
        {gecko?.name || 'Unknown'}
      </p>
      {gecko?.gecko_id_code && (
        <p className="text-[10px] text-slate-500 truncate w-full text-center">
          {gecko.gecko_id_code}
        </p>
      )}
    </div>
  );
}

function emptyForm() {
  const nextYear = new Date().getFullYear() + 1;
  return {
    sire_id: '',
    dam_id: '',
    target_season: 'spring',
    target_year: nextYear,
    goals: '',
    notes: '',
  };
}

const FutureBreedingPlans = forwardRef(function FutureBreedingPlans({ geckos }, ref) {
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const { toast } = useToast();

  const maleGeckos = useMemo(
    () => geckos.filter((g) => g.sex === 'Male' && !g.archived),
    [geckos]
  );
  const femaleGeckos = useMemo(
    () => geckos.filter((g) => g.sex === 'Female' && !g.archived),
    [geckos]
  );

  const loadPlans = async () => {
    setIsLoading(true);
    try {
      const data = await FutureBreedingPlan.list('target_year');
      setPlans(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load future plans:', err);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadPlans();
  }, []);

  // Turn a future plan into a real breeding plan (Breeding page), then
  // mark the future plan as started so it is not offered again and the
  // server stops reminding about it.
  const [startingId, setStartingId] = useState(null);
  const queryClient = useQueryClient();
  const startPairing = async (plan) => {
    const sire = geckos.find((g) => g.id === plan.sire_id);
    const dam = geckos.find((g) => g.id === plan.dam_id);
    if (!sire || !dam) {
      toast({ title: 'Both parents are needed', description: 'One or both parents are no longer in your collection. Edit the plan first.', variant: 'destructive' });
      return;
    }
    setStartingId(plan.id);
    try {
      const [user, activePlans] = await Promise.all([
        User.me(),
        BreedingPlan.filter({ archived: false }).catch(() => []),
      ]);
      const limit = checkPlanLimit(user, 'breeding_pairs', (activePlans || []).length);
      if (!limit.allowed) {
        toast({ title: 'Breeding pair limit reached', description: `Your plan allows ${limit.limit} active breeding pair${limit.limit === 1 ? '' : 's'}. Archive a finished pair on the Breeding page or upgrade on Membership.`, variant: 'destructive' });
        return;
      }
      const created = await BreedingPlan.create(buildPlanFromFuturePlan(plan, sire, dam));
      await FutureBreedingPlan.update(plan.id, {
        started_breeding_plan_id: created?.id || null,
        started_at: new Date().toISOString(),
        notified: true,
      });
      // The Breeding page caches its plans; show the new one right away.
      queryClient.invalidateQueries({ queryKey: ['breeding'] });
      await loadPlans();
      toast({ title: 'Pairing started', description: `${sire.name} x ${dam.name} is now on your Breeding page.` });
    } catch (err) {
      console.error('Start pairing failed:', err);
      toast({ title: 'Could not start the pairing', description: err.message || 'Try again.', variant: 'destructive' });
    } finally {
      setStartingId(null);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setIsModalOpen(true);
  };

  // Expose openCreate so the parent page can trigger the modal
  useImperativeHandle(ref, () => ({ openCreate }));

  const openEdit = (plan) => {
    setEditing(plan);
    setForm({
      sire_id: plan.sire_id,
      dam_id: plan.dam_id,
      target_season: plan.target_season,
      target_year: plan.target_year,
      goals: plan.goals || '',
      notes: plan.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.sire_id || !form.dam_id) {
      toast({
        title: 'Pick both parents',
        description: 'Select a sire and a dam before saving.',
        variant: 'destructive',
      });
      return;
    }
    setIsSaving(true);
    const payload = {
      sire_id: form.sire_id,
      dam_id: form.dam_id,
      target_season: form.target_season,
      target_year: Number(form.target_year),
      goals: form.goals.trim(),
      notes: form.notes.trim(),
    };
    try {
      if (editing) {
        // Editing a plan resets the notification flag so the user gets
        // alerted again if they moved it to a future season.
        await FutureBreedingPlan.update(editing.id, {
          ...payload,
          notified: false,
          notified_date: null,
        });
      } else {
        await FutureBreedingPlan.create(payload);
      }
      setIsModalOpen(false);
      setEditing(null);
      setForm(emptyForm());
      await loadPlans();
      toast({ title: editing ? 'Plan updated' : 'Plan created' });
    } catch (err) {
      console.error('Save failed:', err);
      toast({ title: 'Error', description: err.message || 'Save failed', variant: 'destructive' });
    }
    setIsSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      await FutureBreedingPlan.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadPlans();
      toast({ title: 'Plan removed' });
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const sortedPlans = useMemo(() => {
    const order = { spring: 0, summer: 1, fall: 2, winter: 3 };
    return [...plans].sort((a, b) => {
      if (a.target_year !== b.target_year) return a.target_year - b.target_year;
      return (order[a.target_season] || 0) - (order[b.target_season] || 0);
    });
  }, [plans]);

  const formSire = geckos.find((g) => g.id === form.sire_id);
  const formDam = geckos.find((g) => g.id === form.dam_id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-slate-100 font-semibold flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-emerald-400" />
            Future Breeding Plans
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Plan pairings for a future season. You'll get a notification when the target window opens, even with the app closed.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : sortedPlans.length === 0 ? (
        <div className="text-center py-10 text-slate-500 border border-dashed border-slate-700 rounded-lg">
          <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No future breeding plans yet.</p>
          <p className="text-xs mt-1">Add one to pre-pair geckos for an upcoming season.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sortedPlans.map((plan) => {
            const sire = geckos.find((g) => g.id === plan.sire_id);
            const dam = geckos.find((g) => g.id === plan.dam_id);
            const status = seasonStatus(plan.target_season, plan.target_year);
            const window = computeSeasonWindow(plan.target_season, plan.target_year);
            const statusStyles = {
              future: 'bg-slate-700/40 text-slate-300 border-slate-600',
              active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
              past: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
            };

            return (
              <Card key={plan.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                        {sire?.name || '?'} × {dam?.name || '?'}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`border ${statusStyles[status]} text-[10px] uppercase tracking-wider`}
                        >
                          {status === 'active' ? (
                            <>
                              <Bell className="w-3 h-3 mr-1" /> Ready now
                            </>
                          ) : status === 'past' ? (
                            'Season passed'
                          ) : (
                            'Upcoming'
                          )}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {SEASON_LABELS[plan.target_season]} {plan.target_year}
                        </span>
                      </div>
                      {window && (
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {window.label}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-slate-400 hover:text-slate-200"
                        onClick={() => openEdit(plan)}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-400 hover:text-red-300"
                        onClick={() => setDeleteTarget(plan)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-1 space-y-3">
                  {/* Sire + dam photo row. Each parent is a small portrait
                      card tagged with ♂/♀ and the gecko's name; a gradient
                      "×" divider between the two reinforces the pairing. */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <ParentPortrait gecko={sire} role="sire" />
                    <div className="flex flex-col items-center text-slate-500">
                      <span className="text-2xl leading-none">×</span>
                    </div>
                    <ParentPortrait gecko={dam} role="dam" />
                  </div>

                  {plan.goals && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Goals</p>
                      <p className="text-sm text-slate-300">{plan.goals}</p>
                    </div>
                  )}
                  {plan.notes && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Notes</p>
                      <p className="text-xs text-slate-400 whitespace-pre-wrap">{plan.notes}</p>
                    </div>
                  )}
                  {(!sire || !dam) && (
                    <div className="flex items-start gap-1.5 text-xs text-amber-400">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>One or both parents are missing from your collection.</span>
                    </div>
                  )}
                  {plan.started_breeding_plan_id ? (
                    <p className="text-xs text-emerald-300">
                      Started {plan.started_at ? new Date(plan.started_at).toLocaleDateString() : ''}.{' '}
                      <Link to="/Breeding" className="underline">Open on the Breeding page</Link>
                    </p>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => startPairing(plan)}
                      disabled={startingId === plan.id || !sire || !dam}
                      className="w-full bg-emerald-700 hover:bg-emerald-800 text-white"
                    >
                      {startingId === plan.id
                        ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        : <PlayCircle className="w-4 h-4 mr-2" />}
                      Start this pairing
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / edit modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && !isSaving && setIsModalOpen(false)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              {editing ? 'Edit future breeding plan' : 'New future breeding plan'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Plan a pairing for a future season. When the target season opens you'll get a notification (bell, plus push or email if you turned those on).
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div>
              <Label className="text-slate-300">Sire (male)</Label>
              <Select
                value={form.sire_id}
                onValueChange={(v) => setForm({ ...form, sire_id: v })}
              >
                <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100 mt-1">
                  <SelectValue placeholder="Pick a male" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 max-h-64">
                  {maleGeckos.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                      {g.gecko_id_code ? ` · ${g.gecko_id_code}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">Dam (female)</Label>
              <Select
                value={form.dam_id}
                onValueChange={(v) => setForm({ ...form, dam_id: v })}
              >
                <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100 mt-1">
                  <SelectValue placeholder="Pick a female" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 max-h-64">
                  {femaleGeckos.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                      {g.gecko_id_code ? ` · ${g.gecko_id_code}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">Target season</Label>
              <Select
                value={form.target_season}
                onValueChange={(v) => setForm({ ...form, target_season: v })}
              >
                <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                  {SEASONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SEASON_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">Target year</Label>
              <Select
                value={String(form.target_year)}
                onValueChange={(v) => setForm({ ...form, target_year: Number(v) })}
              >
                <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                  {YEAR_OPTIONS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-slate-300">Goals (what you're trying to produce)</Label>
              <Input
                value={form.goals}
                onChange={(e) => setForm({ ...form, goals: e.target.value })}
                placeholder="e.g. Lilly White harlequins with a strong dorsal pattern"
                className="bg-slate-950 border-slate-700 text-slate-100 mt-1"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-slate-300">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Any reminders for when this season rolls around..."
                className="bg-slate-950 border-slate-700 text-slate-100 mt-1 min-h-20"
              />
            </div>
          </div>

          {/* Genetic predictions for the currently selected parents */}
          <div className="border-t border-slate-800 pt-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-200">
              <Dna className="w-4 h-4 text-purple-400" /> Genetic predictions
            </div>
            <GeneticCalculator sire={formSire} dam={formDam} />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !form.sire_id || !form.dam_id}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {editing ? 'Save changes' : 'Create plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This only removes the future plan. It does not touch the actual geckos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-700 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

export default FutureBreedingPlans;
