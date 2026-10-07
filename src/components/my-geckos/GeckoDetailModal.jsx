import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';
import StickerGeckoActions from '@/components/store/StickerGeckoActions';
import { useState, useEffect, useMemo } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WeightRecord, BreedingPlan, Egg, Gecko, GeckoEvent, GeckoImage, FeedingRecord, FeedingGroup } from '@/entities/all';
import { buildBuyerPacket, renderBuyerPacketPDF, packetFilename } from '@/lib/buyerPacket';
import { photoDataUrl, qrDataUrl, downloadPdf } from '@/lib/buyerPacketAssets';
import { readinessFor } from '@/lib/breedingReadiness';
import { ReadinessNote } from '@/components/breeding/BreedingReadiness';
import { format } from 'date-fns';
import { X, Plus, Trash2, LineChart, Loader2, Award, GitBranch, Calendar, Baby, Users, Edit, Eye, EyeOff, History, Archive, ArchiveRestore, ChevronLeft, ChevronRight, Camera, QrCode, ArrowRightLeft, ExternalLink, FileText, Maximize2 } from 'lucide-react';
import LoadingSpinner from '../shared/LoadingSpinner';
import SmartImage from '../shared/SmartImage';
import EventTracker from './EventTracker';
import BreedingHistory from './BreedingHistory';
import VetRecordsSection from '@/components/gecko/VetRecordsSection';
import HusbandryHistory from '@/components/gecko/HusbandryHistory';
import MarketValueCard from '@/components/gecko/MarketValueCard';
import WeighInReminderSwitch from '@/components/gecko/WeighInReminderSwitch';
import HealthScreenCard from '@/components/health/HealthScreenCard';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import WeightChart from '@/components/shared/WeightChart';
import FireStatePair from '@/components/shared/FireStatePair';
import { FIRE_SLOTS, fireStatePhotos } from '@/lib/fireStatePhotos';
import CollectionActivity from '@/components/settings/CollectionActivity';
import { isGuestMode } from '@/lib/guestMode';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  generateOwnershipCertificatePDF,
  generateLineageCertificatePDF,
} from '@/lib/certificateUtils';
import { toast } from '@/components/ui/use-toast';
import { todayLocalISO, parseLocalDate, formatAge } from '@/lib/dateUtils';
import { useNavigate } from 'react-router-dom';
import { generatePassportCode } from '@/lib/passportUtils';
import { createPageUrl } from '@/utils';
import { PRIMARY_MORPHS } from '@/components/morph-id/morphTaxonomy';
import TransferDialog from '@/components/transfers/TransferDialog';

// The species ("Crested Gecko") is NOT a morph, and genetic traits
// (Lilly White, Axanthic, ...) are not primary morphs. When syncing a
// gecko's photos into the gecko_images training corpus, only fill
// primary_morph when a tag actually maps to a canonical primary-morph
// PATTERN id. Anything else stays null instead of polluting the corpus
// with species/trait labels the AI Morph ID model can't return.
const PRIMARY_MORPH_ID_BY_LABEL = new Map(
  PRIMARY_MORPHS.map((m) => [m.label.toLowerCase(), m.id]),
);
function resolvePrimaryMorphId(gecko) {
  const candidates = [
    ...(Array.isArray(gecko.morph_tags) ? gecko.morph_tags : []),
    ...String(gecko.morphs_traits || '').split(','),
  ];
  for (const candidate of candidates) {
    const id = PRIMARY_MORPH_ID_BY_LABEL.get(String(candidate).trim().toLowerCase());
    if (id) return id;
  }
  return null;
}

// `canEdit` mirrors the geckos UPDATE/DELETE RLS policy on the client
//, it's true for the gecko's original creator and for any accepted
// owner/editor member of the gecko's collection. Defaults to true for
// backwards compatibility with call sites that haven't been migrated
// to compute it; those sites worked under the old "you only see your
// own geckos" model. New call sites that surface shared geckos
// (MyGeckos as of Phase B) should pass an explicit value.
export default function GeckoDetailModal({ gecko, onClose, onUpdate, onEdit, onArchive, onDelete, allGeckos = [], currentUser = null, canEdit = true }) {
  const navigate = useNavigate();

  const handleLineageClick = () => {
    const url = `${createPageUrl('Lineage')}?geckoId=${gecko.id}`;
    onClose();
    navigate(url);
  };
  const [weightRecords, setWeightRecords] = useState([]);
  const [breedingHistory, setBreedingHistory] = useState([]);
  const [eggHistory, setEggHistory] = useState([]);
  const [offspring, setOffspring] = useState([]);
  const [eventHistory, setEventHistory] = useState([]);
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [newWeightDate, setNewWeightDate] = useState(todayLocalISO);
  // Bumped after a feeding or shed is logged from "+ Event" so the
  // feeding and shed history reloads.
  const [husbandryKey, setHusbandryKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingCert, setIsGeneratingCert] = useState(false);
  const [isMakingPacket, setIsMakingPacket] = useState(false);
  const [isPublic, setIsPublic] = useState(gecko?.is_public ?? true);
  const [showTransfer, setShowTransfer] = useState(false);
  const [confirmPrivate, setConfirmPrivate] = useState(false);
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const [showSlideshow, setShowSlideshow] = useState(false);

  // Life-stage slideshow: derived from images the keeper has tagged in the
  // edit form. image_crop_data[url].life_stage holds the tag, the LIFE_STAGES
  // order in form/constants.js determines the slideshow ordering.
  const LIFE_STAGE_ORDER = ['hatchling', '3mo', '6mo', '1yr', '2yr', 'adult'];
  const LIFE_STAGE_LABELS = {
    hatchling: 'Hatchling',
    '3mo': '3 months',
    '6mo': '6 months',
    '1yr': '1 year',
    '2yr': '2 years',
    adult: 'Adult',
  };

  const taggedSlides = useMemo(() => {
    if (!gecko?.image_urls?.length) return [];
    const cropData = gecko.image_crop_data || {};
    return gecko.image_urls
      .map((url) => ({ url, stage: cropData[url]?.life_stage }))
      .filter((s) => s.stage && LIFE_STAGE_ORDER.includes(s.stage))
      .sort((a, b) => LIFE_STAGE_ORDER.indexOf(a.stage) - LIFE_STAGE_ORDER.indexOf(b.stage));
  }, [gecko]);

  const slideshowAvailable = gecko?.growth_slideshow_enabled && taggedSlides.length > 0;
  const currentSlide = taggedSlides[Math.min(slideshowIndex, Math.max(0, taggedSlides.length - 1))];

  const loadEventHistory = async () => {
    if (!gecko) return;
    try {
      const events = await GeckoEvent.filter({ gecko_id: gecko.id }, '-event_date');
      setEventHistory(events);
    } catch (error) {
      console.error('Failed to load event history:', error);
    }
  };

  useEffect(() => {
    const fetchDetailedData = async () => {
      if (!gecko) return;
      
      setIsLoading(true);
      try {
        const [weights, breedings, eggs, children, events] = await Promise.allSettled([
          WeightRecord.filter({ gecko_id: gecko.id }, '-record_date'),
          Promise.all([
            BreedingPlan.filter({ sire_id: gecko.id }, '-created_date'),
            BreedingPlan.filter({ dam_id: gecko.id }, '-created_date')
          ]).then(([sireBreedings, damBreedings]) => [...sireBreedings, ...damBreedings]),
          gecko.sex === 'Female' ? Egg.filter({ 
            breeding_plan_id: { $in: await BreedingPlan.filter({ dam_id: gecko.id }).then(plans => plans.map(p => p.id)) }
          }, '-lay_date') : Promise.resolve([]),
          Promise.all([
            Gecko.filter({ sire_id: gecko.id }, '-hatch_date'),
            Gecko.filter({ dam_id: gecko.id }, '-hatch_date')
          ]).then(([sireOffspring, damOffspring]) => [...sireOffspring, ...damOffspring]),
          GeckoEvent.filter({ gecko_id: gecko.id }, '-event_date')
        ]);

        setWeightRecords(weights.status === 'fulfilled' ? weights.value : []);
        setBreedingHistory(breedings.status === 'fulfilled' ? breedings.value : []);
        setEggHistory(eggs.status === 'fulfilled' ? eggs.value : []);
        setOffspring(children.status === 'fulfilled' ? children.value : []);
        setEventHistory(events.status === 'fulfilled' ? events.value : []);
      } catch (error) {
        console.error('Failed to fetch detailed gecko data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetailedData();
  }, [gecko]);

  const handleAddWeight = async () => {
    if (!newWeight || isNaN(parseFloat(newWeight))) return;
    const today = todayLocalISO();
    const recordDate = newWeightDate && newWeightDate <= today ? newWeightDate : today;

    try {
      const weightValue = parseFloat(newWeight);
      const newRecord = {
        gecko_id: gecko.id,
        weight_grams: weightValue,
        record_date: recordDate,
      };

      const createdRecord = await WeightRecord.create(newRecord);
      // Mirror the newest weigh-in onto the gecko row, like every other
      // weigh path does. Without this the card kept showing an older weight
      // while the chart showed the new one (18 geckos had drifted by Sep
      // 2026). A backdated weigh-in older than the latest one leaves the
      // current weight alone.
      const isNewest = weightRecords.every((r) => !r.record_date || r.record_date <= recordDate);
      if (isNewest) await Gecko.update(gecko.id, { weight_grams: weightValue });

      setWeightRecords(
        [createdRecord, ...weightRecords].sort((a, b) => String(b.record_date).localeCompare(String(a.record_date))),
      );
      setNewWeight('');
      setNewWeightDate(todayLocalISO());
      setShowAddWeight(false);
      
      // Notify parent component to refresh gecko data
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to add weight record:', error);
    }
  };

  const [weightToDelete, setWeightToDelete] = useState(null);

  const handleConfirmDeleteWeight = async () => {
    if (!weightToDelete) return;
    try {
      await WeightRecord.delete(weightToDelete);
      const remaining = weightRecords.filter(r => r.id !== weightToDelete);
      setWeightRecords(remaining);

      // Update Gecko.weight_grams to reflect the new latest (or null if none left)
      const newLatest = remaining.length > 0
        ? [...remaining].sort((a, b) => new Date(b.record_date) - new Date(a.record_date))[0].weight_grams
        : null;
      await Gecko.update(gecko.id, { weight_grams: newLatest });
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to delete weight record:', error);
    }
    setWeightToDelete(null);
  };

  const handleTogglePublic = async (checked, { confirmed = false } = {}) => {
    // A passport link (and every printed QR label) only works while the
    // gecko is public, so ask before switching a passport gecko to private.
    if (!checked && gecko.passport_code && !confirmed) {
      setConfirmPrivate(true);
      return;
    }
    try {
      await Gecko.update(gecko.id, { is_public: checked });
      setIsPublic(checked);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to update public status:', error);
    }
  };

  const handleGenerateCertificate = async (type) => {
      if (!gecko || !gecko.id) {
          toast({
              title: 'Save the gecko first',
              description: 'Certificates can only be generated for saved geckos.',
              variant: 'destructive',
          });
          return;
      }

      setIsGeneratingCert(true);

      try {
          // Resolve parents + grandparents from allGeckos (already in memory).
          const getById = (id) => (id ? allGeckos.find((g) => g.id === id) : null);
          const sire = getById(gecko.sire_id);
          const dam = getById(gecko.dam_id);
          const grandparents = {
              gsS: sire ? getById(sire.sire_id) : null,
              gdS: sire ? getById(sire.dam_id) : null,
              gsD: dam ? getById(dam.sire_id) : null,
              gdD: dam ? getById(dam.dam_id) : null,
          };

          const breedingHistoryProps = {
              eggs: eggHistory,
              breedingPlans: breedingHistory,
              weightRecords,
              hatchDate: gecko.hatch_date,
          };

          if (type === 'ownership') {
              generateOwnershipCertificatePDF(gecko, currentUser, { breedingHistory: breedingHistoryProps });
          } else {
              generateLineageCertificatePDF({
                  gecko,
                  sire,
                  dam,
                  grandparents,
                  owner: currentUser,
                  breedingHistory: breedingHistoryProps,
              });
          }

          toast({
              title: 'Certificate downloaded',
              description: `${type === 'ownership' ? 'Ownership' : 'Lineage'} certificate for ${gecko.name || 'your gecko'} has been saved to your downloads.`,
          });
      } catch (error) {
          console.error('Failed to generate certificate:', error);
          toast({
              title: 'Could not generate certificate',
              description: error?.message || String(error) || 'Unknown error.',
              variant: 'destructive',
          });
      } finally {
          setIsGeneratingCert(false);
      }
  };

  // Buyer packet: one PDF to hand over with a sold gecko (photo, traits,
  // lineage, weights, feeding, passport QR). Private notes stay out.
  const handleBuyerPacket = async () => {
      if (!gecko?.id) return;
      setIsMakingPacket(true);
      try {
          const getById = (id) => (id ? allGeckos.find((g) => g.id === id) : null);
          const sireG = getById(gecko.sire_id);
          const damG = getById(gecko.dam_id);
          const grandparents = {
              gsS: sireG ? getById(sireG.sire_id) : null,
              gdS: sireG ? getById(sireG.dam_id) : null,
              gsD: damG ? getById(damG.sire_id) : null,
              gdD: damG ? getById(damG.dam_id) : null,
          };
          let feedings = [];
          try { feedings = await FeedingRecord.filter({ animal_id: gecko.id }, '-date', 8); } catch { feedings = []; }
          let feedingGroup = null;
          if (gecko.feeding_group_id) {
              try { feedingGroup = (await FeedingGroup.filter({ id: gecko.feeding_group_id }))?.[0] || null; } catch { feedingGroup = null; }
          }
          const passportUrl = gecko.passport_code ? `${window.location.origin}/passport/${gecko.passport_code}` : null;
          const fireSlots = fireStatePhotos(gecko);
          const [photo, qr, firedUp, firedDown] = await Promise.all([
              photoDataUrl(gecko.image_urls?.[0]),
              qrDataUrl(passportUrl),
              photoDataUrl(fireSlots.fired_up),
              photoDataUrl(fireSlots.fired_down),
          ]);
          const firePhotos = FIRE_SLOTS.map((slot, i) => ({ label: slot.label, dataUrl: [firedUp, firedDown][i] }));
          const packet = buildBuyerPacket({
              gecko, sire: sireG, dam: damG, grandparents,
              weights: weightRecords, feedings, feedingGroup,
              seller: currentUser, passportUrl,
          });
          downloadPdf(renderBuyerPacketPDF(packet, { photo, qr, firePhotos }), packetFilename(gecko));
          toast({
              title: 'Buyer packet downloaded',
              description: passportUrl
                  ? `Send it to the buyer of ${gecko.name || 'this gecko'}.`
                  : 'Create a passport first if you want a scannable QR code on it.',
          });
      } catch (error) {
          console.error('Failed to build buyer packet:', error);
          toast({ title: 'Could not build the buyer packet', description: error?.message || 'Unknown error.', variant: 'destructive' });
      } finally {
          setIsMakingPacket(false);
      }
  };

  // Get parent info for display
  const sire = allGeckos.find(g => g.id === gecko.sire_id);
  const dam = allGeckos.find(g => g.id === gecko.dam_id);

  const readiness = readinessFor(gecko, weightRecords);
  const isOwner = Boolean(currentUser?.email) && gecko?.created_by === currentUser.email;
  const latestWeightValue = weightRecords.length > 0
    ? [...weightRecords].sort((a, b) => String(b.record_date).localeCompare(String(a.record_date)))[0].weight_grams
    : (gecko?.weight_grams ?? null);


  if (!gecko) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <TransferDialog
        open={showTransfer}
        onOpenChange={setShowTransfer}
        animal={gecko}
        animalType="gecko"
      />
      <AlertDialog open={confirmPrivate} onOpenChange={setConfirmPrivate}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">Make {gecko.name || 'this gecko'} private?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {gecko.name || 'This gecko'} has a passport ({gecko.passport_code}). While it is private, the passport
              link and any printed QR labels show &ldquo;Private passport&rdquo; to everyone but you. Switch it
              back to public to make them work again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600">Keep it public</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => {
                setConfirmPrivate(false);
                handleTogglePublic(false, { confirmed: true });
              }}
            >
              Make private
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Card className="max-w-6xl w-full max-h-[90vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-slate-700 p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <CardTitle className="text-slate-100 truncate">{gecko.name}</CardTitle>
            {gecko.gecko_id_code && (
              <Badge variant="outline" className="text-slate-300 flex-shrink-0 hidden sm:inline-flex">
                ID: {gecko.gecko_id_code}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 touch:gap-2 flex-shrink-0">
            <EventTracker
              entityId={gecko.id}
              entityType="gecko"
              EventEntity={GeckoEvent}
              gecko={gecko}
              onEventAdded={loadEventHistory}
              onHusbandryLogged={() => setHusbandryKey((k) => k + 1)}
            />
            {/* The full page holds the same record plus lineage links,
                hidden genetics and lookalikes. */}
            {gecko.id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { onClose(); navigate(`${createPageUrl('GeckoDetail')}?id=${gecko.id}`); }}
                className="border-slate-600 hover:bg-slate-800"
                title="Open the full page for this gecko"
              >
                <Maximize2 className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Full page</span>
              </Button>
            )}
            {canEdit ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(gecko)}
                className="border-slate-600 hover:bg-slate-800"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            ) : (
              <span
                className="text-xs px-2.5 py-1 rounded border border-slate-700 bg-slate-800/40 text-slate-400 hidden sm:inline-flex items-center gap-1.5"
                title="You have read-only access to this collection. Ask the owner to grant you editor permissions."
              >
                Read-only
              </span>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5 text-slate-400" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6 overflow-y-auto flex-1">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left column: Image + Basic Information */}
            <div className="space-y-6">
              <div className="space-y-2">
                {slideshowAvailable && (
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setShowSlideshow(false)}
                      className={`text-xs px-3 py-1 touch:min-h-11 rounded-full transition-colors ${!showSlideshow ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                    >
                      Latest
                    </button>
                    <button
                      onClick={() => { setShowSlideshow(true); setSlideshowIndex(0); }}
                      className={`text-xs px-3 py-1 touch:min-h-11 rounded-full flex items-center gap-1 transition-colors ${showSlideshow ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                    >
                      <Camera className="w-3 h-3" /> Growth Slideshow
                    </button>
                  </div>
                )}

                {showSlideshow && slideshowAvailable && currentSlide ? (
                  <div className="space-y-2">
                    {/* Life-stage tabs, one per tagged photo */}
                    <div className="flex flex-wrap gap-1 touch:gap-2">
                      {taggedSlides.map((slide, idx) => (
                        <button
                          key={slide.url}
                          onClick={() => setSlideshowIndex(idx)}
                          className={`text-xs px-2 py-1 touch:min-h-11 rounded transition-colors ${slideshowIndex === idx ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                        >
                          {LIFE_STAGE_LABELS[slide.stage] || slide.stage}
                        </button>
                      ))}
                    </div>
                    {/* Slideshow display + prev/next */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSlideshowIndex((i) => Math.max(0, i - 1))}
                        disabled={slideshowIndex === 0}
                        className="bg-slate-700 hover:bg-slate-600 text-white p-1.5 touch:min-h-11 touch:min-w-11 touch:inline-flex touch:items-center touch:justify-center rounded-lg disabled:opacity-30 flex-shrink-0 z-10"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div className="relative flex-1 rounded-lg overflow-hidden bg-slate-800 min-h-[160px]">
                        <SmartImage
                          key={`slide-${currentSlide.url}`}
                          src={currentSlide.url}
                          alt={`${gecko.name} at ${LIFE_STAGE_LABELS[currentSlide.stage] || currentSlide.stage}`}
                          width={800}
                          aspect="auto"
                          containerClassName="w-full max-h-64"
                          className="object-contain"
                          style={{
                            transform: gecko.image_crop_data?.[currentSlide.url]?.rotation
                              ? `rotate(${gecko.image_crop_data[currentSlide.url].rotation}deg)`
                              : undefined,
                          }}
                          fallback={DEFAULT_GECKO_IMAGE}
                        />
                        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                          {LIFE_STAGE_LABELS[currentSlide.stage] || currentSlide.stage} · {slideshowIndex + 1}/{taggedSlides.length}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSlideshowIndex((i) => Math.min(taggedSlides.length - 1, i + 1))}
                        disabled={slideshowIndex === taggedSlides.length - 1}
                        className="bg-slate-700 hover:bg-slate-600 text-white p-1.5 touch:min-h-11 touch:min-w-11 touch:inline-flex touch:items-center touch:justify-center rounded-lg disabled:opacity-30 flex-shrink-0 z-10"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 text-center">
                      Tag more photos in the edit form to add slides.
                    </p>
                  </div>
                ) : (
                  <div className="w-full rounded-lg overflow-hidden">
                    <SmartImage
                      src={gecko.image_urls?.[0]}
                      alt={gecko.name}
                      width={800}
                      aspect="auto"
                      containerClassName="w-full max-h-80"
                      className="object-contain"
                      style={{
                        transform: gecko.image_urls?.[0] && gecko.image_crop_data?.[gecko.image_urls[0]]?.rotation
                          ? `rotate(${gecko.image_crop_data[gecko.image_urls[0]].rotation}deg)`
                          : undefined,
                      }}
                      fallback={DEFAULT_GECKO_IMAGE}
                    />
                  </div>
                )}
                <FireStatePair gecko={gecko} className="mt-4" />
              </div>
              
              {/* Right: Basic info, morphs, notes, toggles */}
              <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-100">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4 text-slate-300 text-sm">
                  <div>
                    <span className="text-slate-400">Sex:</span>
                    <p className="font-medium">{gecko.sex}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Status:</span>
                    <p className="font-medium">{gecko.status}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Hatch Date:</span>
                    <p className="font-medium">
                      {gecko.hatch_date ? (
                        <>
                          {format(parseLocalDate(gecko.hatch_date), 'PPP')}
                          {formatAge(gecko.hatch_date) && (
                            <span className="text-slate-400 font-normal"> · {formatAge(gecko.hatch_date)} old</span>
                          )}
                        </>
                      ) : 'Unknown'}
                    </p>
                  </div>
                  {gecko.incubation_days && (
                    <div>
                      <span className="text-slate-400">Incubation:</span>
                      <p className="font-medium text-blue-400">{gecko.incubation_days} days</p>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400">Current Weight:</span>
                    <p className="font-medium">
                      {weightRecords.length > 0
                        ? `${[...weightRecords].sort((a, b) => new Date(b.record_date) - new Date(a.record_date))[0].weight_grams}g`
                        : gecko.weight_grams ? `${gecko.weight_grams}g` : 'Not recorded'}
                    </p>
                  </div>
                  {gecko.tail_status && (
                    <div>
                      <span className="text-slate-400">Tail:</span>
                      <p className="font-medium capitalize">{gecko.tail_status}</p>
                    </div>
                  )}
                  {gecko.sex === 'Female' && gecko.is_gravid && (
                    <div className="col-span-2">
                      <span className="text-pink-400 font-semibold text-sm">💕 Gravid</span>
                      <div className="flex flex-wrap gap-4 mt-1">
                        {gecko.gravid_since && (
                          <p className="text-slate-300 text-xs">Since: {format(parseLocalDate(gecko.gravid_since), 'MMM d, yyyy')}</p>
                        )}
                        {gecko.egg_drop_date && (
                          <p className="text-slate-300 text-xs">Egg Drop: {format(parseLocalDate(gecko.egg_drop_date), 'MMM d, yyyy')}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {canEdit && !gecko.archived && readiness && (
                  <div>
                    <span className="text-slate-400 text-sm">Breeding readiness:</span>
                    <div className="mt-1">
                      <ReadinessNote gecko={gecko} readiness={readiness} />
                    </div>
                  </div>
                )}

                {gecko.morphs_traits && (
                  <div>
                    <span className="text-slate-400 text-sm">Morphs & Traits:</span>
                    <p className="text-slate-300 font-medium mt-1">{gecko.morphs_traits}</p>
                  </div>
                )}

                {gecko.notes && (
                  <div>
                    <span className="text-slate-400 text-sm">Notes:</span>
                    <p className="text-slate-300 mt-1">{gecko.notes}</p>
                  </div>
                )}
              </div>

              {canEdit && <StickerGeckoActions gecko={gecko} />}

              {/* Public Display Toggle */}
              <div className="space-y-3 mb-4">
                <div className="bg-slate-800 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isPublic ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-slate-500" />}
                      <Label className="text-slate-300 cursor-pointer">Public Display</Label>
                    </div>
                    <Switch
                      checked={isPublic}
                      onCheckedChange={handleTogglePublic}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {isPublic ? 'Visible in your public profile' : 'Hidden from public view'}
                  </p>
                </div>
                
                <div className="bg-slate-800 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 cursor-pointer">Gallery Display</Label>
                    <Switch
                      checked={gecko.gallery_display || false}
                      onCheckedChange={async (checked) => {
                        try {
                          await Gecko.update(gecko.id, { gallery_display: checked });
                          // Sync GeckoImage rows so the public Gallery page
                          // actually shows the gecko's photos. Without this
                          // the gallery_display flag was decorative, the
                          // public gallery reads from gecko_images, not
                          // from the geckos table.
                          const imageUrls = Array.isArray(gecko.image_urls)
                            ? gecko.image_urls.filter(Boolean)
                            : [];
                          if (checked && imageUrls.length > 0) {
                            // Fetch existing GeckoImage rows tied to this gecko's URLs
                            // to avoid duplicates, then create any that are missing.
                            const existing = await GeckoImage.filter({
                              created_by: gecko.created_by,
                            }).catch(() => []);
                            const existingUrls = new Set(
                              existing.map((row) => row.image_url).filter(Boolean)
                            );
                            for (const url of imageUrls) {
                              if (existingUrls.has(url)) continue;
                              try {
                                await GeckoImage.create({
                                  image_url: url,
                                  primary_morph: resolvePrimaryMorphId(gecko),
                                  secondary_traits: Array.isArray(gecko.morph_tags)
                                    ? gecko.morph_tags
                                    : [],
                                  notes: `Gallery entry for ${gecko.name}`,
                                  verified: false,
                                });
                              } catch (imgErr) {
                                console.warn('Failed to create GeckoImage:', imgErr);
                              }
                            }
                          } else if (!checked && imageUrls.length > 0) {
                            // Toggle off: remove any GeckoImage rows that came
                            // from this gecko (matched by URL + creator).
                            const urlSet = new Set(imageUrls);
                            const mine = await GeckoImage.filter({
                              created_by: gecko.created_by,
                            }).catch(() => []);
                            for (const row of mine) {
                              if (urlSet.has(row.image_url)) {
                                try {
                                  await GeckoImage.delete(row.id);
                                } catch (delErr) {
                                  console.warn('Failed to remove GeckoImage:', delErr);
                                }
                              }
                            }
                          }
                          if (onUpdate) onUpdate();
                          toast({
                            title: checked ? 'Added to gallery' : 'Removed from gallery',
                            description: checked
                              ? `${imageUrls.length} ${imageUrls.length === 1 ? 'photo' : 'photos'} now in the public gallery`
                              : 'Photos removed from the public gallery',
                          });
                        } catch (error) {
                          console.error('Failed to update gallery display:', error);
                          toast({
                            title: 'Update failed',
                            description: error.message || 'Could not update gallery display.',
                            variant: 'destructive',
                          });
                        }
                      }}
                      className="data-[state=checked]:bg-emerald-500"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Show this gecko's photos in the public Gallery
                  </p>
                </div>
              </div>
              </div>
            </div>

            {/* Middle column: Weight / Breeding / Event history */}
            <div className="space-y-6">
              {/* Weight Tracking */}
              <div>
                <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                  <LineChart className="w-5 h-5" />
                  Weight History
                </h3>
                
                {isLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <LoadingSpinner size="md" />
                  </div>
                ) : weightRecords.length > 0 ? (
                  <div className="space-y-4">
                    <WeightChart records={weightRecords} gecko={gecko} height={200} />
                    
                    <div className="max-h-32 overflow-y-auto space-y-2">
                      {weightRecords.map(record => (
                        <div key={record.id} className="flex justify-between items-center bg-slate-800 p-2 rounded text-sm">
                          <span className="text-slate-300">{format(parseLocalDate(record.record_date), 'MMM d, yyyy')}</span>
                          <span className="font-bold text-emerald-400">{record.weight_grams}g</span>
                          <AlertDialog open={weightToDelete === record.id} onOpenChange={(open) => { if (!open) setWeightToDelete(null); }}>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 md:h-6 md:w-6" onClick={() => setWeightToDelete(record.id)}>
                                <Trash2 className="w-3 h-3 text-red-500"/>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-slate-900 border-slate-700">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-slate-100">Delete weight record?</AlertDialogTitle>
                                <AlertDialogDescription className="text-slate-400">
                                  This will permanently delete the weight record from {format(parseLocalDate(record.record_date), 'MMM d, yyyy')}. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-600">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleConfirmDeleteWeight} className="bg-red-700 hover:bg-red-800">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-8">No weight records yet.</p>
                )}

                {/* Add Weight Record */}
                {!showAddWeight ? (
                  <Button onClick={() => setShowAddWeight(true)} variant="outline" size="sm" className="w-full mt-4">
                    <Plus className="w-4 h-4 mr-2" /> Add Weight Record
                  </Button>
                ) : (
                  <div className="space-y-3 mt-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="new-weight-grams" className="text-xs text-slate-400">Weight (g)</Label>
                        <Input
                          id="new-weight-grams"
                          type="number"
                          inputMode="decimal"
                          placeholder="34"
                          value={newWeight}
                          onChange={(e) => setNewWeight(e.target.value)}
                          className="bg-slate-800 text-sm w-full"
                        />
                      </div>
                      <div>
                        <Label htmlFor="new-weight-date" className="text-xs text-slate-400">Weighed on</Label>
                        <Input
                          id="new-weight-date"
                          type="date"
                          max={todayLocalISO()}
                          value={newWeightDate}
                          onChange={(e) => setNewWeightDate(e.target.value)}
                          className="bg-slate-800 text-sm w-full"
                        />
                      </div>
                    </div>
                    <Button onClick={handleAddWeight} className="w-full">Save</Button>
                  </div>
                )}
                {isOwner && !isGuestMode() && (
                  <WeighInReminderSwitch
                    gecko={gecko}
                    email={currentUser?.email}
                    lastWeighDate={weightRecords.length > 0 ? [...weightRecords].sort((a, b) => String(b.record_date).localeCompare(String(a.record_date)))[0].record_date : null}
                  />
                )}
              </div>

              {/* Feeding and shed history plus the shed forecast, from the
                  same log Field Mode, Batch Husbandry and Mark fed write. */}
              <HusbandryHistory gecko={gecko} weights={weightRecords} refreshKey={husbandryKey} legacyEvents={eventHistory} />

              {/* Breeding History */}
              <div>
                <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Breeding History
                </h3>
                
                {breedingHistory.length > 0 ? (
                  <div className="space-y-3">
                    {breedingHistory.map(breeding => {
                      const partner = gecko.sex === 'Male' 
                        ? allGeckos.find(g => g.id === breeding.dam_id)
                        : allGeckos.find(g => g.id === breeding.sire_id);
                      
                      return (
                        <div key={breeding.id} className="bg-slate-800 p-3 rounded-lg">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                            <span className="text-slate-300 font-medium">
                              Paired with: {partner?.name || 'Unknown'}
                            </span>
                            <div className="flex items-center gap-2 mt-2 sm:mt-0">
                              <Badge variant={breeding.status === 'Successful' ? 'default' : 'secondary'}>
                                {breeding.status}
                              </Badge>
                              {breeding.is_public && (
                                <Badge variant="outline" className="text-emerald-400 border-emerald-400">
                                  Public
                                </Badge>
                              )}
                            </div>
                          </div>
                          {breeding.pairing_date && (
                            <p className="text-slate-400 text-sm">
                              Paired: {format(parseLocalDate(breeding.pairing_date), 'PPP')}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <Label className="text-xs text-slate-500">Public Display</Label>
                            <Switch
                              checked={breeding.is_public}
                              onCheckedChange={async (checked) => {
                                try {
                                  await BreedingPlan.update(breeding.id, { is_public: checked });
                                  const updated = await Promise.allSettled([
                                    WeightRecord.filter({ gecko_id: gecko.id }, '-record_date'),
                                    Promise.all([
                                      BreedingPlan.filter({ sire_id: gecko.id }, '-created_date'),
                                      BreedingPlan.filter({ dam_id: gecko.id }, '-created_date')
                                    ]).then(([sireBreedings, damBreedings]) => [...sireBreedings, ...damBreedings]),
                                    gecko.sex === 'Female' ? Egg.filter({ 
                                      breeding_plan_id: { $in: await BreedingPlan.filter({ dam_id: gecko.id }).then(plans => plans.map(p => p.id)) }
                                    }, '-lay_date') : Promise.resolve([]),
                                    Promise.all([
                                      Gecko.filter({ sire_id: gecko.id }, '-hatch_date'),
                                      Gecko.filter({ dam_id: gecko.id }, '-hatch_date')
                                    ]).then(([sireOffspring, damOffspring]) => [...sireOffspring, ...damOffspring])
                                  ]);
                                  setBreedingHistory(updated[1].status === 'fulfilled' ? updated[1].value : []);
                                } catch (error) {
                                  console.error('Failed to update breeding plan:', error);
                                }
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-4">No breeding history recorded.</p>
                )}
              </div>

              {/* Event History */}
              <div>
                <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Event History
                </h3>
                {eventHistory.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {eventHistory.map(event => {
                      const eventIcons = {
                        shed: '🦎',
                        feeding: '🍽️',
                        defecation: '💩',
                        cage_cleaning: '🧹',
                        bug_feeding: '🦗',
                        custom: '✏️'
                      };
                      return (
                        <div key={event.id} className="bg-slate-800 p-3 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{eventIcons[event.event_type] || '📋'}</span>
                              <span className="text-slate-200 font-medium text-sm capitalize">
                                {event.event_type === 'custom' ? event.custom_event_name : event.event_type.replace('_', ' ')}
                              </span>
                            </div>
                            <span className="text-slate-400 text-xs">
                              {format(new Date(event.event_date), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                          {event.notes && (
                            <p className="text-slate-400 text-xs mt-1">{event.notes}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-4 text-sm">No events recorded yet.</p>
                )}
              </div>

              {/* Vet visits: logged here, shown on the passport, with a
                  reminder on the follow-up date. */}
              <VetRecordsSection
                gecko={gecko}
                canEdit={canEdit && !isGuestMode()}
                currentUserEmail={currentUser?.email || null}
              />

              {/* Who did what, when this gecko sits in a shared collection.
                  Renders nothing for geckos that were never shared. */}
              {!isGuestMode() && (
                <CollectionActivity
                  geckoId={gecko.id}
                  currentEmail={currentUser?.email}
                  hideWhenEmpty
                  title="Shared activity"
                />
              )}

              {/* Offspring */}
              {offspring.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                    <Baby className="w-5 h-5" />
                    Offspring ({offspring.length})
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {offspring.map(child => (
                      <div key={child.id} className="bg-slate-800 p-2 rounded flex items-center justify-between">
                        <div>
                          <p className="text-slate-200 font-medium text-sm">{child.name}</p>
                          <p className="text-slate-400 text-xs">{child.sex}</p>
                        </div>
                        {child.hatch_date && (
                          <p className="text-slate-400 text-xs">
                            {format(parseLocalDate(child.hatch_date), 'MMM yyyy')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Breeding History summary (per-season, females only) */}
              {gecko.sex === 'Female' && (
                <BreedingHistory
                  eggs={eggHistory}
                  breedingPlans={breedingHistory}
                  weightRecords={weightRecords}
                  hatchDate={gecko.hatch_date}
                />
              )}

              {/* Egg History (for females) */}
              {gecko.sex === 'Female' && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Egg History
                  </h3>
                  
                  {eggHistory.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {eggHistory.map(egg => (
                        <div key={egg.id} className="bg-slate-800 p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-slate-300 text-sm">
                              Laid: {format(parseLocalDate(egg.lay_date), 'MMM d, yyyy')}
                            </span>
                            <Badge variant={egg.status === 'Hatched' ? 'default' : 'secondary'} className="text-xs">
                              {egg.status}
                            </Badge>
                          </div>
                          {egg.hatch_date_actual && (
                            <p className="text-slate-400 text-xs">
                              Hatched: {format(parseLocalDate(egg.hatch_date_actual), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-center py-4">No eggs recorded.</p>
                  )}
                </div>
              )}
            </div>

            {/* Right column: Value / Health / Certificates / Passport / Lineage / Archive / Parentage */}
            <div className="space-y-3">
              {/* Value estimate, owner only (see MarketValueCard). The demo
                  prices its sample geckos from a dated snapshot. */}
              {isOwner && (
                <MarketValueCard gecko={{ ...gecko, weight_grams: latestWeightValue }} />
              )}
              {/* AI health check; renders nothing without photos. */}
              {canEdit && !isGuestMode() && <HealthScreenCard gecko={gecko} user={currentUser} />}

              <Button
                onClick={() => handleGenerateCertificate('ownership')}
                disabled={isGeneratingCert}
                variant="outline"
                className="w-full border-emerald-700 text-emerald-300 hover:bg-emerald-900/20"
              >
                {isGeneratingCert ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Award className="w-4 h-4 mr-2" /> Ownership Certificate</>
                )}
              </Button>
              <Button
                onClick={() => handleGenerateCertificate('lineage')}
                disabled={isGeneratingCert}
                variant="outline"
                className="w-full border-emerald-700 text-emerald-300 hover:bg-emerald-900/20"
              >
                {isGeneratingCert ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><GitBranch className="w-4 h-4 mr-2" /> Lineage Certificate</>
                )}
              </Button>
              <Button
                onClick={handleBuyerPacket}
                disabled={isMakingPacket}
                variant="outline"
                title="One PDF for the buyer: photo, traits, lineage, weights, feeding and the passport QR"
                className="w-full border-emerald-700 text-emerald-300 hover:bg-emerald-900/20"
              >
                {isMakingPacket ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Building packet...</>
                ) : (
                  <><FileText className="w-4 h-4 mr-2" /> Buyer Packet</>
                )}
              </Button>

              {/* Passport & Transfer Section */}
              <div className="border border-slate-700 rounded-lg p-3 space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-2">Passport & Transfer</p>
                {gecko.passport_code ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => window.open(`/passport/${gecko.passport_code}`, '_blank')}
                      className="border-emerald-700 text-emerald-300 hover:bg-emerald-900/20"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Passport
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.open(`/passport/${gecko.passport_code}/qr`, '_blank')}
                      className="border-slate-600 hover:bg-slate-800"
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      QR Code
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const code = generatePassportCode();
                      try {
                        await Gecko.update(gecko.id, { passport_code: code, is_public: true });
                        // A passport link only works for a public gecko, so this
                        // turns the Public Display switch on; say so.
                        setIsPublic(true);
                        toast({ title: 'Passport created', description: `Code: ${code}. The gecko is now public so its link works.` });
                        if (onUpdate) onUpdate();
                      } catch (err) {
                        toast({ title: 'Passport not created', description: err.message || 'Please try again.', variant: 'destructive' });
                      }
                    }}
                    className="w-full border-emerald-700 text-emerald-300 hover:bg-emerald-900/20"
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    Generate Passport
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowTransfer(true)}
                  className="w-full border-amber-600 text-amber-400 hover:bg-amber-900/20"
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Transfer Ownership
                </Button>
              </div>

              <Button
                variant="outline"
                onClick={handleLineageClick}
                className="w-full border-slate-600 hover:bg-slate-800"
              >
                <GitBranch className="w-4 h-4 mr-2" />
                View Lineage Tree
              </Button>

              {onArchive && canEdit && (
                <div className="space-y-2">
                  {gecko.archived && gecko.archive_reason && (
                    <div className="bg-slate-800 p-3 rounded-lg">
                      <p className="text-xs text-slate-400 mb-2">Archive reason:</p>
                      <div className="flex gap-2">
                        {[
                          { value: 'death', label: 'Passed Away' },
                          { value: 'sold', label: 'Sold' },
                          { value: 'other', label: 'Other' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            onClick={async () => {
                              await Gecko.update(gecko.id, { archive_reason: opt.value });
                              if (onUpdate) onUpdate();
                            }}
                            className={`text-xs px-2 py-1 touch:min-h-11 touch:min-w-11 rounded border transition-colors ${
                              gecko.archive_reason === opt.value
                                ? 'border-yellow-500 bg-yellow-900/40 text-yellow-300'
                                : 'border-slate-600 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => onArchive(gecko.id, !gecko.archived)}
                    className={gecko.archived ? "w-full border-emerald-600 text-emerald-500 hover:bg-emerald-900/20" : "w-full border-red-600 text-red-500 hover:bg-red-900/20"}
                  >
                    {gecko.archived ? (
                      <><ArchiveRestore className="w-4 h-4 mr-2" /> Unarchive</>
                    ) : (
                      <><Archive className="w-4 h-4 mr-2" /> Archive</>
                    )}
                  </Button>

                  {gecko.archived && onDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full border-red-800 text-red-400 hover:bg-red-950/40 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Permanently Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-slate-900 border-slate-700">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-slate-100">
                            Permanently delete {gecko.name}?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-400">
                            This will <strong className="text-red-400">permanently remove</strong>{' '}
                            <strong>{gecko.name}</strong> and all associated data from your
                            collection. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-600">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDelete(gecko.id)}
                            className="bg-red-700 hover:bg-red-800"
                          >
                            Delete Forever
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              )}

              {/* Parentage */}
              <div className="pt-2 space-y-3">
                <h3 className="text-lg font-semibold text-slate-100">Parentage</h3>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Sire (Father)</p>
                  <p className="text-slate-100 font-semibold">{sire?.name || gecko.sire_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Dam (Mother)</p>
                  <p className="text-slate-100 font-semibold">{dam?.name || gecko.dam_name || 'Unknown'}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}