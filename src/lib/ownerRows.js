/**
 * Owner email addresses kept from other members (owner decision E16,
 * docs/planning/owner-emails-2026-11.md).
 *
 * Seven tables carry the owner's email in created_by: geckos,
 * breeding_plans, and the weight, feeding, shed, vet and ownership
 * records. Members could read it on any public gecko or plan and on the
 * records of a public passport. Since step 2 (14 November 2026) signed-in
 * accounts cannot read that column, so the app must never ask for it.
 * This module makes that true for every read that goes through the entity
 * layer (src/api/supabaseEntities.js sends the seven entities through
 * ownedCall below):
 *
 *   - members read a named list of columns, every column but created_by
 *     (OWNED_MEMBER_EXTRAS, added to the entity layer's lists on load);
 *   - a filter on created_by becomes a filter on owner_profile_id, the
 *     owner's profile id, which the database keeps in step with
 *     created_by;
 *   - the member's own rows get created_by back, set to their own email,
 *     so the many "is this mine" checks (gecko.created_by === user.email)
 *     keep working. Other members' rows carry no created_by at all.
 *
 * Pages that read these tables some other way (a direct supabase query, a
 * database function) use ownerFilterFor, restoreOwnEmail and whoAmI from
 * here. The module loads with the first read of one of these tables, not
 * with the app: every public page counts against a size budget.
 */
import { MEMBER_COLUMN_EXTRAS } from '@/api/supabaseEntities';
import { getSupabase } from '@/lib/supabaseLazy';
import { isGuestMode } from '@/lib/guestMode';
import { readCachedProfile } from '@/lib/offlineSession';

/** The seven entities and their tables. */
export const OWNED_TABLES = {
  Gecko: 'geckos',
  BreedingPlan: 'breeding_plans',
  WeightRecord: 'weight_records',
  FeedingRecord: 'feeding_records',
  ShedRecord: 'shed_records',
  VetRecord: 'vet_records',
  OwnershipRecord: 'ownership_records',
};

/**
 * What a member reads on top of the signed-out list (PUBLIC_READ_COLUMNS
 * in src/lib/publicColumns.js): every other column except created_by.
 * src/lib/memberColumns.js lists the whole result; a test keeps the two in
 * step with each other and with the tables.
 */
export const OWNED_MEMBER_EXTRAS = {
  Gecko: ',sold_price,moderation_hidden,status_before_listing',
  BreedingPlan: ',owner_profile_id',
  WeightRecord: ',client_request_id,owner_profile_id',
  FeedingRecord: ',logged_by,client_request_id,owner_profile_id',
  ShedRecord: ',logged_by,client_request_id,owner_profile_id',
  VetRecord: ',owner_profile_id',
  OwnershipRecord: ',owner_profile_id',
};

/** A filter value no profile id can equal: "rows of nobody". */
export const NO_OWNER = '~no-owner~';

let registered = false;
/** Puts the seven lists into the entity layer's member lists (once). */
export function registerOwnedColumns() {
  if (registered) return;
  Object.assign(MEMBER_COLUMN_EXTRAS, OWNED_MEMBER_EXTRAS);
  registered = true;
}

const lower = (value) => String(value ?? '').trim().toLowerCase();

// The signed-in member: { uid, email, profileId }. The profile id comes
// from their own profile row, which only they (and admins) can read.
let me = null;
let pendingMe = null;
// Other members' profile ids by lowercased email, for filters that name
// someone else (an admin list, a breeder's trust score).
const idByEmail = new Map();

async function client(deps) {
  return (deps?.getSupabase || getSupabase)();
}

/**
 * The signed-in member as { uid, email, profileId }, or null when signed
 * out. profileId is null when the profile could not be read; callers then
 * skip what needs it rather than fail.
 */
export async function whoAmI(deps) {
  let db;
  let user = null;
  try {
    db = await client(deps);
    const { data } = await db.auth.getSession();
    user = data?.session?.user || null;
  } catch {
    return null;
  }
  if (!user?.email) return null;
  if (me && me.uid === user.id && me.profileId) return me;
  if (pendingMe && pendingMe.uid === user.id) return pendingMe.promise;
  const promise = (async () => {
    let profileId = null;
    try {
      const run = () => db.from('profiles').select('id').eq('email', user.email).maybeSingle();
      const { data, error } = await (deps?.withAuthRetry ? deps.withAuthRetry(run) : run());
      if (!error && data?.id != null) profileId = String(data.id);
    } catch {
      // Offline: the copy of the profile kept for signed-in use offline.
    }
    if (!profileId) {
      const cached = readCachedProfile(user.id);
      if (cached?.id != null && lower(cached.email) === lower(user.email)) profileId = String(cached.id);
    }
    const who = { uid: user.id, email: user.email, profileId };
    me = who;
    if (profileId) idByEmail.set(lower(user.email), profileId);
    return who;
  })();
  pendingMe = { uid: user.id, promise };
  try {
    return await promise;
  } finally {
    if (pendingMe?.promise === promise) pendingMe = null;
  }
}

/**
 * The signed-in member's profile id, for a direct owner_profile_id filter,
 * or null when it cannot be read (signed out, or no profile).
 */
export async function myProfileId(deps) {
  return (await whoAmI(deps))?.profileId ?? null;
}

/**
 * Profile ids for these email addresses, as a Map of lowercased email to
 * id. The member's own comes from whoAmI; others from read_profiles, which
 * answers a caller about the addresses it passes. An address with no
 * profile is left out.
 */
export async function profileIdsFor(emails, deps) {
  const wanted = [...new Set((emails || []).map(lower).filter(Boolean))];
  const result = new Map();
  if (wanted.length === 0) return result;
  const who = await whoAmI(deps);
  if (who?.profileId) idByEmail.set(lower(who.email), who.profileId);
  const missing = wanted.filter((e) => !idByEmail.has(e));
  if (missing.length > 0) {
    // read_profiles matches addresses exactly, so send each as given too,
    // in case a stored address keeps capital letters.
    const asGiven = (emails || []).filter((e) => typeof e === 'string' && missing.includes(lower(e))).map((e) => e.trim());
    const ask = [...new Set([...missing, ...asGiven])];
    try {
      const db = await client(deps);
      const run = () => db.rpc('read_profiles', { p_emails: ask }).select('id, email');
      const { data, error } = await (deps?.withAuthRetry ? deps.withAuthRetry(run) : run());
      if (!error) {
        for (const row of data || []) {
          if (row?.id != null && row.email) idByEmail.set(lower(row.email), String(row.id));
        }
      }
    } catch {
      // Unknown owners then match nothing, which is what a failed read shows.
    }
  }
  for (const e of wanted) if (idByEmail.has(e)) result.set(e, idByEmail.get(e));
  return result;
}

function emailsIn(filterObj) {
  const out = [];
  const take = (value) => {
    if (typeof value === 'string') out.push(value);
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (Array.isArray(value.$in)) out.push(...value.$in.filter((v) => typeof v === 'string'));
      if (typeof value.$ne === 'string') out.push(value.$ne);
    }
  };
  for (const [key, value] of Object.entries(filterObj)) {
    if (key === 'created_by') take(value);
    else if (key === '$or' && Array.isArray(value)) {
      for (const clause of value) if (clause && 'created_by' in clause) take(clause.created_by);
    }
  }
  return out;
}

function mapValue(value, ids) {
  const idOf = (email) => ids.get(lower(email)) ?? NO_OWNER;
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return idOf(value);
  if (typeof value === 'object' && !Array.isArray(value)) {
    const out = {};
    for (const [op, v] of Object.entries(value)) {
      if (op === '$in' && Array.isArray(v)) {
        const mapped = [...new Set(v.map(idOf).filter((id) => id !== NO_OWNER))];
        out.$in = mapped.length ? mapped : [NO_OWNER];
      } else if (op === '$ne') out.$ne = v === null ? null : idOf(v);
      else out[op] = v;
    }
    return out;
  }
  return value;
}

/** True when a filter object names created_by anywhere the entity layer reads it. */
export function namesCreatedBy(filterObj) {
  if (!filterObj || typeof filterObj !== 'object') return false;
  if ('created_by' in filterObj) return true;
  return Array.isArray(filterObj.$or) && filterObj.$or.some((c) => c && typeof c === 'object' && 'created_by' in c);
}

/**
 * The same filter with created_by turned into owner_profile_id. An address
 * with no profile becomes NO_OWNER, so it matches nothing, as created_by
 * did for an address that owns nothing.
 */
export async function ownerFilterFor(filterObj, deps) {
  if (!namesCreatedBy(filterObj)) return filterObj;
  const ids = await profileIdsFor(emailsIn(filterObj), deps);
  const out = {};
  for (const [key, value] of Object.entries(filterObj)) {
    if (key === 'created_by') out.owner_profile_id = mapValue(value, ids);
    else if (key === '$or' && Array.isArray(value)) {
      out.$or = value.map((clause) => {
        if (!clause || typeof clause !== 'object' || !('created_by' in clause)) return clause;
        const { created_by: email, ...rest } = clause;
        return { ...rest, owner_profile_id: mapValue(email, ids) };
      });
    } else out[key] = value;
  }
  return out;
}

/**
 * Puts the member's own email back as created_by on their own rows (those
 * whose owner_profile_id is theirs), in place. Takes a row, a list or
 * nothing, and returns what it was given. Never throws.
 */
export async function restoreOwnEmail(rows, deps) {
  const list = Array.isArray(rows) ? rows : rows && typeof rows === 'object' ? [rows] : [];
  if (list.length === 0) return rows;
  let who = null;
  try {
    who = await whoAmI(deps);
  } catch {
    return rows;
  }
  if (!who?.profileId) return rows;
  for (const row of list) {
    if (row && row.created_by == null && row.owner_profile_id != null && String(row.owner_profile_id) === who.profileId) {
      row.created_by = who.email;
    }
  }
  return rows;
}

/**
 * One entity method for one of the seven tables. `base` is the plain
 * entity client; `deps` are the client helpers the entity layer passes in
 * (getSupabase, isGuestMode, withAuthRetry). The demo's sample rows carry
 * their own created_by and are served before any of this.
 */
export async function ownedCall(entityName, method, base, args, deps) {
  registerOwnedColumns();
  if ((deps?.isGuestMode || isGuestMode)()) return base[method](...args);
  if (method === 'filter') {
    const [filterObj, ...rest] = args;
    const filter = await ownerFilterFor(filterObj, deps);
    return restoreOwnEmail(await base.filter(filter, ...rest), deps);
  }
  return restoreOwnEmail(await base[method](...args), deps);
}

/** Forget the signed-in member (sign-out, tests). */
export function forgetOwner() {
  me = null;
  pendingMe = null;
  idByEmail.clear();
}
