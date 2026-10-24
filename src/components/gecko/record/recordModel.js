/**
 * The rules behind the one gecko record (src/components/gecko/record).
 *
 * The record is shown in two places: the window that opens from a card in
 * My Geckos, and the /GeckoDetail page that reminders, passports, profiles
 * and the market link to. Both render the same GeckoRecord component, so
 * who may do what is decided here, once, as plain functions that tests can
 * check without a browser.
 */
import { canDeleteGecko } from '@/lib/geckoAccess';

const sameEmail = (a, b) =>
  Boolean(a) && Boolean(b) && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/**
 * What the viewer may see and do on this gecko's record.
 *
 *   gecko     the gecko row
 *   user      the signed-in member (or the demo guest), or null
 *   canEdit   true when the member may change the gecko: its creator, or an
 *             owner or editor of the collection it sits in (canWriteGecko in
 *             src/lib/geckoAccess.js, which mirrors the database rule)
 *   isMember  true when the member belongs to the gecko's collection in any
 *             role, including a read-only viewer
 *
 * Returns:
 *   isOwner      the member created this gecko
 *   keeper       may read the private care history (feedings, events, vet
 *                visits, breeding plans, eggs, shared activity)
 *   canEdit      may log weigh-ins and events, edit, archive, make a
 *                passport and print the papers
 *   canDelete    may delete it for good: the owner or an admin only, since
 *                deleting also removes every care record (the database
 *                refuses a collection editor since 15 Oct 2026)
 *   canTransfer  may transfer it to a buyer: the owner only (the database
 *                refuses a transfer started by anyone else)
 *   canSeeValue  sees the value estimate: the owner only, because a buyer
 *                seeing a lower estimate beside the asking price would
 *                undercut the seller (see MarketValueCard)
 */
export function recordAccess({ gecko, user, canEdit = false, isMember = false } = {}) {
  const signedIn = Boolean(user?.email);
  const isOwner = signedIn && sameEmail(gecko?.created_by, user.email);
  const write = signedIn && (isOwner || Boolean(canEdit));
  return {
    isOwner,
    keeper: write || (signedIn && Boolean(isMember)),
    canEdit: write,
    canDelete: Boolean(gecko) && canDeleteGecko(gecko, user),
    canTransfer: isOwner,
    canSeeValue: isOwner,
  };
}

/** ISO day strings sort correctly as text; anything else sorts last. */
const dayKey = (r) => (r && typeof r.record_date === 'string' ? r.record_date : '');

/** Weigh-ins, newest first, for the list under the chart. */
export function newestFirst(records = []) {
  return [...(records || [])].sort((a, b) => dayKey(b).localeCompare(dayKey(a)));
}

/**
 * The gecko's current weight: the newest dated weigh-in, or the weight on
 * the gecko row when there are no weigh-ins (older geckos and imports).
 * Returns { grams, date } or null.
 */
export function latestWeighIn(records = [], gecko = null) {
  const dated = (records || []).filter((r) => dayKey(r) && Number.isFinite(Number(r.weight_grams)));
  if (dated.length > 0) {
    const newest = newestFirst(dated)[0];
    return { grams: Number(newest.weight_grams), date: newest.record_date };
  }
  const fallback = gecko?.weight_grams;
  return fallback != null && Number.isFinite(Number(fallback)) ? { grams: Number(fallback), date: null } : null;
}

/**
 * True when a weigh-in on `day` is at least as new as every saved one, so
 * it should also become the weight on the gecko row (the card reads that).
 * A backdated weigh-in leaves the current weight alone.
 */
export function isNewestDay(records = [], day) {
  return (records || []).every((r) => !dayKey(r) || dayKey(r) <= day);
}

/**
 * The jump links under the record's header, one per group that is on the
 * page for this viewer. Care forms stay mounted while moving between
 * groups, so unfinished entries are kept. Ids match `record-<id>`.
 */
export function recordSections({ access, hasWeights = false, hasShedForecast = false, hasPassport = false } = {}) {
  const keeper = Boolean(access?.keeper);
  const canEdit = Boolean(access?.canEdit);
  return [
    { id: 'overview', label: 'Overview' },
    (keeper || canEdit || hasWeights || hasShedForecast) && { id: 'care-history', label: 'Care history' },
    keeper && { id: 'breeding', label: 'Breeding' },
    (canEdit || hasPassport) && { id: 'sharing', label: 'Sharing' },
    { id: 'more', label: 'More' },
  ].filter(Boolean);
}

/** The element id for a section, shared by the section and its jump link. */
export const sectionId = (id) => `record-${id}`;

/**
 * What deleting a gecko removes with it, in the words the delete
 * confirmation (RecordManage) and the toast afterwards (My Geckos) both
 * use. In the database the gecko's weigh-ins go with it (a trigger), and
 * so do its feeding, shed and vet records and its ownership history
 * (foreign keys that cascade).
 */
export const REMOVED_WITH_GECKO = 'every weigh-in, feeding, shed, vet visit and ownership record logged for it';

/** What My Geckos may open for a handed-off gecko (see myGeckosHandoff). */
export const HANDOFF_ACTIONS = Object.freeze(['edit', 'archive', 'sold']);

/**
 * Where the /GeckoDetail page sends the owner for the actions that live in
 * My Geckos: the edit form ('edit'), and the archive dialog with its sale
 * details ('archive', or 'sold' to start on Sold). My Geckos opens this
 * gecko's record and then the form or the dialog. Following the link
 * changes nothing by itself: the form and the dialog still need a Save.
 */
export function myGeckosHandoff(geckoId, open = null) {
  const params = new URLSearchParams({ gecko: String(geckoId) });
  if (HANDOFF_ACTIONS.includes(open)) params.set('open', open);
  return `/MyGeckos?${params.toString()}`;
}

/**
 * What My Geckos does with a handed-off gecko, once it has found it:
 *   openForm       open the edit form instead of the record window
 *   archiveDialog  'ask' to open the archive dialog, 'sold' to open it on
 *                  Sold, or null
 * A member who may not edit the gecko only gets the record window, and an
 * archived gecko is not asked to be archived again.
 */
export function handoffSteps(open, { archived = false, mayEdit = false } = {}) {
  const none = { openForm: false, archiveDialog: null };
  if (!mayEdit) return none;
  if (open === 'edit') return { openForm: true, archiveDialog: null };
  if (open === 'sold') return { openForm: false, archiveDialog: 'sold' };
  if (open === 'archive' && !archived) return { openForm: false, archiveDialog: 'ask' };
  return none;
}

/** Which parent slot the genetics calculator should fill with this gecko. */
export function calculatorLink(gecko) {
  const slot = gecko?.sex === 'Female' ? 'damGecko' : 'sireGecko';
  return `/calculator?${slot}=${encodeURIComponent(gecko?.id ?? '')}`;
}
