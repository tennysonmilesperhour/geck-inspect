import { Suspense, useEffect, useMemo, useState } from 'react';
import { Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import { Gecko, GeckoEvent, WeightRecord, BreedingPlan } from '@/entities/all';
import { isGuestMode } from '@/lib/guestMode';
import { generatePassportCode } from '@/lib/passportUtils';
import { predictNextShed } from '@/lib/shedPrediction';
import { readinessFor } from '@/lib/breedingReadiness';
import { ReadinessCard } from '@/components/breeding/BreedingReadiness';
import MarketValueCard from '@/components/gecko/MarketValueCard';
import EventTracker from '@/components/my-geckos/EventTracker';
import useGeckoRecordData from './useGeckoRecordData';
import { recordAccess, recordSections, latestWeighIn, isNewestDay } from './recordModel';
import { hasMorePhotos, PhotoLightbox, PhotosSection } from './RecordPhotos';
import {
  BottomOffers, CareSection, DetailsCard, FamilyCard, HistorySection, JumpLinks,
  MoreSection, RecordSummary, VetSection,
} from './RecordSections';
import RecordWeights from './RecordWeights';
import RecordPassport from './RecordPassport';
import RecordBreeding from './RecordBreeding';
import RecordManage from './RecordManage';
import { importWithRetry, isStaleChunkError, lazyOptional, RELOAD_HINT } from './loadOnDemand';

// Opened only when the owner taps Transfer, so its code loads then. If it
// cannot be loaded, the tap says to reload instead of failing silently.
const TransferDialog = lazyOptional(
  () => import('@/components/transfers/TransferDialog'),
  function TransferUnavailable({ onOpenChange }) {
    useEffect(() => {
      toast({ title: 'Transfer could not open', description: RELOAD_HINT, variant: 'destructive' });
      onOpenChange?.(false);
    }, [onOpenChange]);
    return null;
  },
);
// The price, breeder and report card is only for people outside the
// collection, so My Geckos never downloads it.
const VisitorAside = lazyOptional(() => import('./RecordVisitor'));

/**
 * The one gecko record. My Geckos opens it in a window from a gecko's card
 * (GeckoDetailModal) and /GeckoDetail shows it as a page (reminder links,
 * passports, profiles, the market), so a new section is added once and
 * both places get it.
 *
 * Order on a phone, top to bottom: name and photo; jump links to every
 * section; parents and the value estimate (both in view without
 * scrolling); weights with the growth chart; feeding and sheds; vet
 * visits; photos; passport, transfer and papers; breeding; event history;
 * genetics, health check and lookalikes; manage (archive, delete); and the
 * sticker and supplies offers last.
 *
 * Props:
 *   gecko        the gecko row
 *   currentUser  the signed-in member, the demo guest, or null
 *   canEdit      canWriteGecko() for this member (owner or collection editor)
 *   isMember     the member belongs to the gecko's collection in any role
 *   allGeckos    the member's collection when the host has it (parents,
 *                pairing partners and the papers' lineage come from it
 *                before asking the database)
 *   variant      'modal' (heading levels under the window's title, sticky
 *                bar) or 'page' (the name is the page's h1)
 *   leading      the host's Close or Back button, first in the bar
 *   onUpdate()   the gecko row changed; the host reloads it
 *   onEdit(gecko), onArchive(id, shouldArchive), onMarkSold(id),
 *   onDelete(id) the host's edit form and archive and delete flows. Leave
 *                one out and its button is not shown.
 */
export default function GeckoRecord({
  gecko,
  currentUser = null,
  canEdit = false,
  isMember = false,
  allGeckos = [],
  variant = 'modal',
  leading = null,
  onUpdate,
  onEdit,
  onArchive,
  onMarkSold,
  onDelete,
}) {
  const access = recordAccess({ gecko, user: currentUser, canEdit, isMember });
  const guest = isGuestMode();
  const record = useGeckoRecordData(gecko, { keeper: access.keeper, isOwner: access.isOwner, allGeckos });

  // Fields this record just changed, shown at once while the host reloads
  // the row. A fresh row from the host replaces them.
  const [patch, setPatch] = useState({});
  useEffect(() => { setPatch({}); }, [gecko]);
  const view = useMemo(() => ({ ...gecko, ...patch }), [gecko, patch]);

  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [husbandryKey, setHusbandryKey] = useState(0);
  const [showTransfer, setShowTransfer] = useState(false);
  const [confirmPrivate, setConfirmPrivate] = useState(false);
  const [busyPaper, setBusyPaper] = useState(null);

  const titleLevel = variant === 'page' ? 'h1' : 'h2';
  const sectionLevel = variant === 'page' ? 'h2' : 'h3';
  const latest = latestWeighIn(record.weights, view);
  const shedForecast = access.keeper
    ? null
    : predictNextShed({ sheds: record.publicSheds, weights: record.weights, weightGrams: view.weight_grams, hatchDate: view.hatch_date });
  const morePhotos = hasMorePhotos(view);
  const sections = recordSections({
    access,
    hasWeights: record.weights.length > 0,
    hasShedForecast: Boolean(shedForecast),
    hasPassport: Boolean(view.passport_code),
    hasMorePhotos: morePhotos,
    isFemale: view.sex === 'Female',
  });
  const readiness = access.canEdit && !view.archived ? readinessFor(view, record.weights) : null;
  const known = useMemo(
    () => [...(allGeckos || []), ...record.partners, record.sire, record.dam].filter(Boolean),
    [allGeckos, record.partners, record.sire, record.dam],
  );
  const partnerFor = (plan) => {
    const partnerId = plan.sire_id === view.id ? plan.dam_id : plan.sire_id;
    return known.find((g) => g.id === partnerId) || null;
  };

  const changed = (fields) => {
    if (fields) setPatch((p) => ({ ...p, ...fields }));
    onUpdate?.();
  };

  const failed = (title, error) => {
    // In the demo the app already shows one "create an account to save"
    // prompt for every blocked write; a second error toast would be noise.
    if (error?.isGuestBlock) return;
    console.error(title, error);
    const description = isStaleChunkError(error) ? RELOAD_HINT : error?.message || 'Please try again.';
    toast({ title, description, variant: 'destructive' });
  };

  // Weigh-ins. The newest one is mirrored onto the gecko row, like every
  // other weigh path, because the card reads the weight from there.
  const addWeight = async (grams, day) => {
    let created;
    try {
      created = await WeightRecord.create({ gecko_id: view.id, weight_grams: grams, record_date: day });
    } catch (error) {
      failed('Weigh-in not saved', error);
      return false;
    }
    const newest = isNewestDay(record.weights, day);
    record.setWeights((ws) => [created || { gecko_id: view.id, weight_grams: grams, record_date: day }, ...ws]);
    if (newest) {
      // The weigh-in is saved either way; a failed mirror only leaves the
      // card showing the older weight until the next weigh-in.
      try {
        await Gecko.update(view.id, { weight_grams: grams });
      } catch (error) {
        console.error('Weigh-in saved, but the gecko weight was not updated:', error);
      }
    }
    changed(newest ? { weight_grams: grams } : null);
    return true;
  };

  const deleteWeight = async (id) => {
    try {
      await WeightRecord.delete(id);
    } catch (error) {
      failed('Weigh-in not deleted', error);
      return;
    }
    const remaining = record.weights.filter((r) => r.id !== id);
    record.setWeights(remaining);
    // The gecko row takes the newest weigh-in left, or none.
    const next = latestWeighIn(remaining, null);
    const grams = next ? next.grams : null;
    try {
      await Gecko.update(view.id, { weight_grams: grams });
    } catch (error) {
      console.error('Weigh-in deleted, but the gecko weight was not updated:', error);
    }
    changed({ weight_grams: grams });
  };

  // A passport link (and every printed QR card) only works while the gecko
  // is public, so switching a passport gecko to private asks first.
  const isPublic = view.is_public ?? true;
  const setPublic = async (checked, { confirmed = false } = {}) => {
    if (!checked && view.passport_code && !confirmed) {
      setConfirmPrivate(true);
      return;
    }
    try {
      await Gecko.update(view.id, { is_public: checked });
      changed({ is_public: checked });
    } catch (error) {
      failed('Could not change who can see this gecko', error);
    }
  };

  const setGallery = async (checked) => {
    try {
      const { setGalleryDisplay } = await importWithRetry(() => import('./galleryDisplay'));
      const photos = await setGalleryDisplay(view, checked);
      changed({ gallery_display: checked });
      toast({
        title: checked ? 'Added to the gallery' : 'Removed from the gallery',
        description: checked
          ? `${photos} ${photos === 1 ? 'photo submitted' : 'photos submitted'} to the public Gallery. Photos from established members appear right away; others appear after a quick check.`
          : 'Its photos are no longer in the public Gallery.',
      });
    } catch (error) {
      failed('Gallery not updated', error);
    }
  };

  const createPassport = async () => {
    const code = generatePassportCode();
    try {
      await Gecko.update(view.id, { passport_code: code, is_public: true });
      changed({ passport_code: code, is_public: true });
      // A passport link only works for a public gecko, so this turns
      // Public display on; say so.
      toast({ title: 'Passport made', description: `Code ${code}. ${view.name || 'The gecko'} is now public so the link works.` });
    } catch (error) {
      failed('Passport not made', error);
    }
  };

  const makePaper = async (kind) => {
    if (!view.id || busyPaper) return;
    setBusyPaper(kind);
    try {
      const exports = await importWithRetry(() => import('./recordExports'));
      if (kind === 'packet') {
        const link = await exports.downloadBuyerPacket({ gecko: view, seller: currentUser, known, weights: record.weights });
        toast({
          title: 'Buyer packet downloaded',
          description: link
            ? `Send it to the buyer of ${view.name || 'this gecko'}.`
            : 'Make a passport first if you want a scannable QR code on it.',
        });
      } else {
        await exports.downloadCertificate(kind, {
          gecko: view, owner: currentUser, known, eggs: record.eggs, plans: record.plans, weights: record.weights,
        });
        toast({
          title: 'Certificate downloaded',
          description: `${kind === 'ownership' ? 'Ownership' : 'Lineage'} certificate for ${view.name || 'your gecko'} is in your downloads.`,
        });
      }
    } catch (error) {
      failed(kind === 'packet' ? 'Could not build the buyer packet' : 'Could not make the certificate', error);
    } finally {
      setBusyPaper(null);
    }
  };

  const setPlanPublic = async (plan, checked) => {
    try {
      await BreedingPlan.update(plan.id, { is_public: checked });
      record.setPlans((plans) => plans.map((p) => (p.id === plan.id ? { ...p, is_public: checked } : p)));
    } catch (error) {
      failed('Pairing not updated', error);
    }
  };

  const setArchiveReason = async (reason) => {
    // Sold asks for the price first, the same as archiving as sold.
    if (reason === 'sold' && view.archive_reason !== 'sold' && onMarkSold) {
      onMarkSold(view.id);
      return;
    }
    try {
      await Gecko.update(view.id, { archive_reason: reason });
      changed({ archive_reason: reason });
    } catch (error) {
      failed('Reason not saved', error);
    }
  };

  const refreshEvents = () => {
    GeckoEvent.filter({ gecko_id: view.id }, '-event_date')
      .then((rows) => record.setEvents(rows))
      .catch(() => {});
  };

  if (!gecko) return null;

  return (
    <div className="gecko-record text-slate-200" data-gecko-record={variant}>
      <div
        className={`flex items-center gap-2 px-4 py-2 border-b border-slate-800 ${
          variant === 'modal' ? 'sticky top-0 z-20 bg-slate-900/95 backdrop-blur' : ''
        }`}
      >
        {leading}
        <div className="ml-auto flex items-center gap-2">
          {access.canEdit && (
            <EventTracker
              entityId={view.id}
              entityType="gecko"
              EventEntity={GeckoEvent}
              gecko={view}
              onEventAdded={refreshEvents}
              onHusbandryLogged={() => setHusbandryKey((k) => k + 1)}
            />
          )}
          {access.canEdit && onEdit ? (
            <Button variant="outline" size="sm" onClick={() => onEdit(view)} aria-label={`Edit ${view.name || 'gecko'}`}>
              <Edit className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          ) : access.keeper && !access.canEdit ? (
            <span
              className="text-xs px-2.5 py-1 rounded border border-slate-700 bg-slate-800/40 text-slate-400"
              title="You can view this collection but not change it. Ask the owner for editor access."
            >
              Read-only
            </span>
          ) : null}
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        <RecordSummary gecko={view} latest={latest} headingAs={titleLevel} onOpenPhoto={() => setLightboxIndex(0)} />
        <JumpLinks sections={sections} />

        <div className="grid gap-4 lg:grid-cols-2 items-start">
          <FamilyCard
            gecko={view}
            sire={record.sire}
            dam={record.dam}
            offspringCount={record.offspring.length}
            canEdit={access.canEdit}
            headingAs={sectionLevel}
          />
          {access.canSeeValue
            ? <MarketValueCard gecko={{ ...view, weight_grams: latest ? latest.grams : null }} />
            : !access.keeper && (
              <Suspense fallback={null}>
                <VisitorAside gecko={view} owner={record.owner} currentUser={currentUser} headingAs={sectionLevel} />
              </Suspense>
            )}

          {readiness && <ReadinessCard gecko={view} readiness={readiness} />}
          <DetailsCard gecko={view} headingAs={sectionLevel} />

          <RecordWeights
            gecko={view}
            weights={record.weights}
            latest={latest}
            loading={record.loading}
            canEdit={access.canEdit}
            reminder={access.isOwner && !guest ? { email: currentUser?.email } : null}
            onAdd={addWeight}
            onDelete={deleteWeight}
            headingAs={sectionLevel}
          />
          <CareSection
            gecko={view}
            keeper={access.keeper}
            weights={record.weights}
            legacyEvents={record.events}
            refreshKey={husbandryKey}
            shedForecast={shedForecast}
            headingAs={sectionLevel}
          />

          {access.keeper && (
            <VetSection gecko={view} canEdit={access.canEdit && !guest} currentUserEmail={currentUser?.email || null} headingAs={sectionLevel} />
          )}
          {morePhotos && <PhotosSection gecko={view} onOpen={setLightboxIndex} headingAs={sectionLevel} />}

          <RecordPassport
            gecko={view}
            access={access}
            busy={busyPaper}
            isPublic={isPublic}
            galleryDisplay={view.gallery_display}
            onCreatePassport={createPassport}
            onTransfer={() => setShowTransfer(true)}
            onPaper={makePaper}
            onTogglePublic={(checked) => setPublic(checked)}
            onToggleGallery={setGallery}
            headingAs={sectionLevel}
          />

          {access.keeper && (
            <RecordBreeding
              gecko={view}
              plans={record.plans}
              eggs={record.eggs}
              offspring={record.offspring}
              weights={record.weights}
              canEdit={access.canEdit}
              partnerFor={partnerFor}
              onTogglePlanPublic={setPlanPublic}
              headingAs={sectionLevel}
            />
          )}
          {access.keeper && (
            <HistorySection gecko={view} events={record.events} currentUserEmail={currentUser?.email} guest={guest} headingAs={sectionLevel} />
          )}
        </div>

        <MoreSection gecko={view} weights={record.weights} currentUser={currentUser} headingAs={sectionLevel} />

        <RecordManage
          gecko={view}
          access={access}
          onArchive={onArchive}
          onReason={setArchiveReason}
          onDelete={onDelete}
          headingAs={sectionLevel}
        />

        <BottomOffers gecko={view} canEdit={access.canEdit} />
      </div>

      {lightboxIndex !== null && (
        <PhotoLightbox gecko={view} index={lightboxIndex} onIndex={setLightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}

      {showTransfer && (
        <Suspense fallback={null}>
          <TransferDialog open={showTransfer} onOpenChange={setShowTransfer} animal={view} animalType="gecko" />
        </Suspense>
      )}

      <AlertDialog open={confirmPrivate} onOpenChange={setConfirmPrivate}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">Make {view.name || 'this gecko'} private?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {view.name || 'This gecko'} has a passport ({view.passport_code}). While it is private, the passport
              link and any printed QR cards show &ldquo;Private passport&rdquo; to everyone but you. Switch it
              back to public to make them work again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600">Keep it public</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => {
                setConfirmPrivate(false);
                setPublic(false, { confirmed: true });
              }}
            >
              Make private
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
