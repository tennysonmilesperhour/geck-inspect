import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { BreedingPlan, Gecko } from '@/entities/all';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseLocalDate } from '@/lib/dateUtils';
import { earlierPairings } from '@/lib/eggSire';

const NONE = '__none__';

/**
 * The dam's breeding plans and the males in them, for choosing which male
 * a clutch came from (src/lib/eggSire.js). Loads only while `active`.
 * Males not in `knownGeckos` are looked up one by one; one the member can
 * no longer read shows as "Earlier sire".
 *
 * @returns {{ damPlans: object[], sires: Record<string, object>, loading: boolean }}
 */
export function useDamPairings(plan, { active = true, knownGeckos = [] } = {}) {
    const [state, setState] = useState({ damPlans: [], sires: {}, loading: false });
    const damId = plan?.dam_id;
    // The parents the caller already has, so they are not fetched again.
    // Kept in a ref: callers pass a new array each render.
    const knownRef = useRef([]);
    knownRef.current = (knownGeckos || []).filter(Boolean);

    useEffect(() => {
        if (!active || !damId) return undefined;
        let cancelled = false;
        setState((s) => ({ ...s, loading: true }));
        (async () => {
            const damPlans = await BreedingPlan.filter({ dam_id: damId }).catch(() => []);
            const sires = {};
            for (const g of knownRef.current) sires[g.id] = g;
            const missing = [...new Set((damPlans || []).map((p) => p?.sire_id).filter((id) => id && !sires[id]))];
            await Promise.all(missing.map(async (id) => {
                const g = await Gecko.get(id).catch(() => null);
                if (g) sires[id] = g;
            }));
            if (!cancelled) setState({ damPlans: damPlans || [], sires, loading: false });
        })();
        return () => { cancelled = true; };
    }, [active, damId]);

    return state;
}

const shortDate = (iso) => (iso ? format(parseLocalDate(iso), 'MMM d, yyyy') : null);

/**
 * "Sire of this clutch" and "Could also be" for a clutch whose dam was
 * paired with another male before this plan. Renders nothing when the dam
 * has no other pairing and the clutch has no sire of its own recorded.
 *
 * Props: plan, planSire, dam, layDate, damPlans, sires (id to gecko),
 * sireId and possibleSireId (null means the plan's sire / none),
 * onChange({ sireId, possibleSireId }), disabled.
 */
export default function ClutchSireFields({
    plan, planSire, dam, layDate, damPlans = [], sires = {},
    sireId = null, possibleSireId = null, onChange, disabled = false, idPrefix = 'clutch',
}) {
    const pairings = useMemo(
        () => earlierPairings({ plan, damPlans, layDate }),
        [plan, damPlans, layDate],
    );
    // A value saved earlier stays choosable even if its plan was deleted.
    const options = useMemo(() => {
        const list = pairings.map((p) => ({ id: p.sireId, contactDate: p.contactDate, recent: p.recent }));
        for (const id of [sireId, possibleSireId]) {
            if (id && id !== plan?.sire_id && !list.some((o) => o.id === id)) list.push({ id, contactDate: null, recent: false });
        }
        return list;
    }, [pairings, sireId, possibleSireId, plan?.sire_id]);

    if (options.length === 0) return null;

    const nameOf = (id) => sires[id]?.name || (id === plan?.sire_id ? planSire?.name : null) || 'Earlier sire';
    const chosen = sireId || plan?.sire_id || '';
    const recent = options.find((o) => o.recent);
    const damName = dam?.name || 'This female';

    return (
        <div className="space-y-3 rounded-lg border border-amber-800/60 bg-amber-950/20 p-3">
            {recent ? (
                <p className="text-sm text-amber-200">
                    {damName} was paired with {nameOf(recent.id)}
                    {recent.contactDate ? ` until ${shortDate(recent.contactDate)}` : ''}. A female can store sperm for months, so this clutch may be his.
                </p>
            ) : (
                <p className="text-sm text-slate-300">
                    {damName} has been paired with another male. If this clutch is his, choose him here so the hatchlings get the right father.
                </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <Label htmlFor={`${idPrefix}-sire`}>Sire of this clutch</Label>
                    <Select
                        value={chosen}
                        disabled={disabled}
                        onValueChange={(v) => onChange?.({
                            sireId: v === plan?.sire_id ? null : v,
                            possibleSireId: possibleSireId === v ? null : possibleSireId,
                        })}
                    >
                        <SelectTrigger id={`${idPrefix}-sire`} className="bg-slate-800 border-slate-600"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                            {plan?.sire_id && (
                                <SelectItem value={plan.sire_id}>{nameOf(plan.sire_id)} (this pairing)</SelectItem>
                            )}
                            {options.map((o) => (
                                <SelectItem key={o.id} value={o.id}>
                                    {nameOf(o.id)}{o.contactDate ? `, paired until ${shortDate(o.contactDate)}` : ', earlier pairing'}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor={`${idPrefix}-possible-sire`}>Could also be</Label>
                    <Select
                        value={possibleSireId || NONE}
                        disabled={disabled}
                        onValueChange={(v) => onChange?.({ sireId, possibleSireId: v === NONE ? null : v })}
                    >
                        <SelectTrigger id={`${idPrefix}-possible-sire`} className="bg-slate-800 border-slate-600"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                            <SelectItem value={NONE}>Sure of the sire</SelectItem>
                            {[plan?.sire_id, ...options.map((o) => o.id)]
                                .filter((id) => id && id !== chosen)
                                .map((id) => (
                                    <SelectItem key={id} value={id}>{nameOf(id)}</SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <p className="text-xs text-slate-400">
                Applies to every egg laid that day. Hatchlings take the sire you choose; if you are not sure, their passport says the sire is not confirmed.
            </p>
        </div>
    );
}
