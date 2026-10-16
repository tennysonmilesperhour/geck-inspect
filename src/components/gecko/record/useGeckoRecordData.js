import { useCallback, useEffect, useRef, useState } from 'react';
import { WeightRecord, ShedRecord, GeckoEvent, BreedingPlan, Egg, Gecko, User } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
import { isGuestMode } from '@/lib/guestMode';
import { PUBLIC_WEIGHT_COLUMNS, PUBLIC_SHED_COLUMNS } from '@/lib/passportUtils';
import { newestFirst } from './recordModel';

const EMPTY = Object.freeze({
  weights: [],
  publicSheds: [],
  events: [],
  plans: [],
  eggs: [],
  offspring: [],
  sire: null,
  dam: null,
  owner: null,
  partners: [],
});

// Signed-out visitors may read a public gecko's weigh-ins and sheds but not
// created_by (an email), so anyone outside the collection asks for the same
// short column list the passport uses. The demo answers from its sample data.
async function publicRows(table, columns, column, id, order) {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq(column, id)
    .order(order, { ascending: false });
  if (error) throw error;
  return data || [];
}

const valueOf = (result, fallback) =>
  result.status === 'fulfilled' && result.value != null ? result.value : fallback;

/**
 * Everything the record shows beyond the gecko row, loaded in one parallel
 * round so the record fills in at once on a phone:
 *
 *   weights      every weigh-in, newest first
 *   publicSheds  shed dates for the next-shed estimate shown to visitors
 *                (keepers see the full shed log through HusbandryHistory)
 *   events       the general event log (keepers only)
 *   plans, eggs  breeding plans this gecko is in, and a female's eggs
 *   offspring    geckos that name this one as sire or dam
 *   sire, dam    the parent rows: from the collection already in memory
 *                when the host has it (My Geckos), fetched otherwise
 *   owner        the breeder's profile, for visitors (the owner and
 *                collection members skip it)
 *   partners     pairing partners the host did not already have
 *
 * The private parts load only for a keeper, so a visitor's page makes
 * three or four small requests instead of nine. Each part fails on its own:
 * a refused request leaves that part empty instead of blanking the record.
 *
 * Returns { ...data, loading, reload, setWeights, setPlans }. The setters
 * let the record show a weigh-in or a plan change at once, without a
 * round trip.
 */
export default function useGeckoRecordData(gecko, { keeper = false, isOwner = false, allGeckos = [] } = {}) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(Boolean(gecko?.id));
  const [reloadKey, setReloadKey] = useState(0);

  // My Geckos hands over a new collection array after every save; reading
  // it through a ref keeps that from refetching the whole record.
  const collectionRef = useRef(allGeckos);
  useEffect(() => {
    collectionRef.current = allGeckos;
  }, [allGeckos]);

  const id = gecko?.id ?? null;
  const female = gecko?.sex === 'Female';
  const sireId = gecko?.sire_id ?? null;
  const damId = gecko?.dam_id ?? null;
  const ownerProfileId = gecko?.owner_profile_id ?? null;
  const ownerEmail = gecko?.created_by ?? null;

  useEffect(() => {
    if (!id) {
      setData(EMPTY);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    const guest = isGuestMode();
    const fromCollection = (pid) => (collectionRef.current || []).find((g) => g?.id === pid) || null;
    const parent = (pid) => {
      if (!pid) return Promise.resolve(null);
      const known = fromCollection(pid);
      return known ? Promise.resolve(known) : Gecko.get(pid).catch(() => null);
    };
    const none = Promise.resolve([]);

    const plansFor = keeper
      ? Promise.all([
          BreedingPlan.filter({ sire_id: id }, '-created_date').catch(() => []),
          BreedingPlan.filter({ dam_id: id }, '-created_date').catch(() => []),
        ])
      : Promise.resolve([[], []]);

    (async () => {
      const results = await Promise.allSettled([
        keeper || guest
          ? WeightRecord.filter({ gecko_id: id }, '-record_date')
          : publicRows('weight_records', PUBLIC_WEIGHT_COLUMNS, 'gecko_id', id, 'record_date'),
        keeper
          ? none
          : guest
            ? ShedRecord.filter({ animal_id: id }, '-date')
            : publicRows('shed_records', PUBLIC_SHED_COLUMNS, 'animal_id', id, 'date'),
        keeper ? GeckoEvent.filter({ gecko_id: id }, '-event_date') : none,
        plansFor,
        // A female's eggs come from the plans she is the dam of, which the
        // plan request above already returns; no second plan lookup.
        keeper && female
          ? plansFor.then(([, asDam]) => {
              const planIds = (asDam || []).map((p) => p.id).filter(Boolean);
              return planIds.length ? Egg.filter({ breeding_plan_id: { $in: planIds } }, '-lay_date') : [];
            })
          : none,
        keeper
          ? Promise.all([
              Gecko.filter({ sire_id: id }, '-hatch_date').catch(() => []),
              Gecko.filter({ dam_id: id }, '-hatch_date').catch(() => []),
            ]).then(([a, b]) => [...(a || []), ...(b || [])])
          : none,
        parent(sireId),
        parent(damId),
        keeper || isOwner
          ? Promise.resolve(null)
          : ownerProfileId
            ? User.get(ownerProfileId)
            : ownerEmail
              ? User.filter({ email: ownerEmail }).then((rows) => rows?.[0] || null)
              : Promise.resolve(null),
      ]);
      if (cancelled) return;
      const [weights, sheds, events, plans, eggs, offspring, sire, dam, owner] = results;
      const [asSire, asDam] = valueOf(plans, [[], []]);
      const allPlans = [...(asSire || []), ...(asDam || [])];
      const next = {
        weights: newestFirst(valueOf(weights, [])),
        // Only dated sheds. The database requires a date, but the forecast
        // throws on a row without one, and a throw here would blank the
        // whole record, so an odd row is dropped instead.
        publicSheds: valueOf(sheds, []).filter((s) => typeof s?.date === 'string' && s.date),
        events: valueOf(events, []),
        plans: allPlans,
        eggs: valueOf(eggs, []),
        offspring: valueOf(offspring, []),
        sire: valueOf(sire, null),
        dam: valueOf(dam, null),
        owner: valueOf(owner, null),
        partners: [],
      };
      setData(next);
      setLoading(false);

      // Pairing partners the host does not already have (the page has no
      // collection in memory) come in one follow-up request, so a pairing
      // reads "Paired with Spud" instead of "an unknown gecko".
      const have = new Set([next.sire?.id, next.dam?.id, ...(collectionRef.current || []).map((g) => g?.id)].filter(Boolean));
      const missing = [...new Set(allPlans.map((p) => (p.sire_id === id ? p.dam_id : p.sire_id)))]
        .filter((pid) => pid && !have.has(pid));
      if (missing.length === 0) return;
      const partners = await Gecko.filter({ id: { $in: missing } }).catch(() => []);
      if (!cancelled && partners?.length) setData((d) => ({ ...d, partners }));
    })();

    return () => {
      cancelled = true;
    };
  }, [id, female, sireId, damId, ownerProfileId, ownerEmail, keeper, isOwner, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const setWeights = useCallback((update) => {
    setData((d) => ({ ...d, weights: newestFirst(typeof update === 'function' ? update(d.weights) : update) }));
  }, []);
  const setEvents = useCallback((events) => setData((d) => ({ ...d, events: events || [] })), []);
  const setPlans = useCallback((update) => {
    setData((d) => ({ ...d, plans: typeof update === 'function' ? update(d.plans) : update }));
  }, []);

  return { ...data, loading, reload, setWeights, setEvents, setPlans };
}
