import { Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Brush, Bug, ClipboardList, Droplets, GitBranch, History,
  Info, PenLine, Sparkles, Utensils,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ArchiveStatusChip from '@/components/my-geckos/ArchiveStatusChip';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { parseLocalDate, formatAge } from '@/lib/dateUtils';
import { formatHetTag } from '@/lib/hetUtils';
import { breederSlug, looksLikeBreederName } from '@/lib/breederUtils';
import { formatShedWindow } from '@/lib/shedPrediction';
import HusbandryHistory from '@/components/gecko/HusbandryHistory';
import VetRecordsSection from '@/components/gecko/VetRecordsSection';
import CollectionActivity from '@/components/settings/CollectionActivity';
import StickerGeckoActions from '@/components/store/StickerGeckoActions';
import { RecordPhoto } from './RecordPhotos';
import RecordCard from './RecordCard';
import { calculatorLink, sectionId } from './recordModel';
import { lazyOptional } from './loadOnDemand';

// Below-the-fold extras load as their own files, when the member scrolls
// near them, so opening a record on a phone fetches only what is on screen.
const HiddenHetPanel = lazyOptional(() => import('@/components/gecko/HiddenHetPanel'));
const HealthScreenCard = lazyOptional(() => import('@/components/health/HealthScreenCard'));
const GrowthReel = lazyOptional(() => import('@/components/gecko/GrowthReel'));
const VisualSiblings = lazyOptional(() => import('@/components/gecko/VisualSiblings'));
const RecommendedKitForGecko = lazyOptional(() => import('@/components/store/RecommendedKitForGecko'));

const HEADING_CLASS = 'text-base font-semibold text-slate-100 mb-3 flex items-center gap-2';
const ICON_CLASS = 'w-4 h-4 text-emerald-400';

const STATUS_COLORS = {
  'Ready to Breed': 'bg-teal-700',
  Proven: 'bg-emerald-700',
  Holdback: 'bg-blue-700',
  'For Sale': 'bg-yellow-700',
  Sold: 'bg-gray-700',
  Pet: 'bg-purple-700',
  'Future Breeder': 'bg-indigo-700',
};

const day = (iso, pattern = 'MMM d, yyyy') => {
  const d = iso ? parseLocalDate(iso) : null;
  return d ? format(d, pattern) : '';
};

/**
 * Renders its children once they come near the screen. Where the browser
 * cannot tell (no IntersectionObserver), it renders them straight away.
 */
export function DeferUntilVisible({ children, margin = '400px', minHeight = 1 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (visible || !ref.current) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: margin });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [visible, margin]);
  if (visible) return children;
  return <div ref={ref} style={{ minHeight }} aria-hidden="true" />;
}

/** Name, photo and the facts a keeper checks first. */
export function RecordSummary({ gecko, latest, headingAs: Heading = 'h2', onOpenPhoto }) {
  const age = formatAge(gecko.hatch_date);
  const morphLine = gecko.morphs_traits
    || (Array.isArray(gecko.morph_tags) && gecko.morph_tags.length ? gecko.morph_tags.map(formatHetTag).join(', ') : '');
  return (
    <div className="flex gap-3 sm:gap-5 items-start">
      <RecordPhoto gecko={gecko} onOpen={onOpenPhoto} />
      <div className="min-w-0 flex-1">
        <Heading className="text-xl sm:text-2xl font-bold text-slate-100 break-words leading-tight">{gecko.name || 'Unnamed gecko'}</Heading>
        {gecko.gecko_id_code && <p className="text-xs text-slate-400 mt-0.5">ID {gecko.gecko_id_code}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {gecko.status && <Badge className={`${STATUS_COLORS[gecko.status] || 'bg-slate-700'} text-white`}>{gecko.status}</Badge>}
          {gecko.sex && <Badge variant="secondary">{gecko.sex}</Badge>}
          {latest && <Badge variant="outline" className="border-slate-600">{latest.grams} g</Badge>}
          {age && <Badge variant="outline" className="border-slate-600">{age === 'today' ? 'Hatched today' : `${age} old`}</Badge>}
          {gecko.sex === 'Female' && gecko.is_gravid && <Badge className="bg-pink-800 text-pink-100">Gravid</Badge>}
          {/* Why it left the collection, in the same words as its card:
              "In memory" for a gecko that died, "Sold", or "Archived". */}
          {gecko.archived && <ArchiveStatusChip reason={gecko.archive_reason || 'other'} />}
        </div>
        {morphLine && <p className="mt-2 text-sm text-slate-300 line-clamp-2">{morphLine}</p>}
      </div>
    </div>
  );
}

/** One tap from the top of the record to each part of the history. */
export function JumpLinks({ sections }) {
  if (!sections?.length) return null;
  const go = (id) => (event) => {
    const target = typeof document !== 'undefined' ? document.getElementById(sectionId(id)) : null;
    if (!target) return;
    event.preventDefault();
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    // Move keyboard focus with the jump, so the next Tab continues here.
    target.focus({ preventScroll: true });
  };
  return (
    <nav aria-label="Parts of this record" className="border-y border-slate-800 py-3">
      <ul className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <li key={s.id}>
            <Button asChild variant="outline" size="sm">
              <a href={`#${sectionId(s.id)}`} onClick={go(s.id)}>{s.label}</a>
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Groups related cards without hiding forms or resetting unfinished entries. */
export function RecordGroup({ id, title, headingAs: Heading = 'h3', columns = true, children }) {
  return (
    <section
      id={sectionId(id)}
      aria-labelledby={sectionId(`${id}-heading`)}
      tabIndex={-1}
      className="scroll-mt-24 space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Heading id={sectionId(`${id}-heading`)} className="text-lg font-semibold text-slate-100">{title}</Heading>
      <div className={columns ? 'grid gap-4 lg:grid-cols-2 items-start' : 'space-y-4'}>{children}</div>
    </section>
  );
}

/**
 * A parent's name. A linked parent opens its own record. A free-text name
 * that reads like a breeder (two capitalised words, or a web address) links
 * to the public breeder page; a plain nickname stays text.
 */
export function ParentName({ linkedGecko, fallbackName }) {
  if (linkedGecko?.id) {
    return (
      <Link to={`${createPageUrl('GeckoDetail')}?id=${linkedGecko.id}`} className="text-emerald-300 hover:text-emerald-200 underline decoration-emerald-500/40 underline-offset-2">
        {linkedGecko.name || fallbackName || 'Unnamed'}
      </Link>
    );
  }
  const text = fallbackName || 'Unknown';
  if (!fallbackName || !looksLikeBreederName(fallbackName)) return <span>{text}</span>;
  const slug = breederSlug(fallbackName);
  if (!slug) return <span>{text}</span>;
  return (
    <Link
      to={`/Breeder/${slug}`}
      className="text-emerald-300 hover:text-emerald-200 underline decoration-emerald-500/40 decoration-dotted underline-offset-2"
      title={`View ${text} on Geck Inspect`}
    >
      {text}
    </Link>
  );
}

/** Sire and dam, with the family tree one tap away. */
export function FamilyCard({ gecko, sire, dam, offspringCount = 0, canEdit = false, headingAs }) {
  return (
    <RecordCard id="family" icon={GitBranch} title="Parents and lineage" headingAs={headingAs} contentClassName="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-800 p-3 rounded-lg min-w-0">
          <p className="text-slate-400 text-xs mb-1">Sire (father)</p>
          <p className="text-slate-100 font-medium break-words"><ParentName linkedGecko={sire} fallbackName={gecko.sire_name} /></p>
        </div>
        <div className="bg-slate-800 p-3 rounded-lg min-w-0">
          <p className="text-slate-400 text-xs mb-1">Dam (mother)</p>
          <p className="text-slate-100 font-medium break-words"><ParentName linkedGecko={dam} fallbackName={gecko.dam_name} /></p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link to={`/Pedigree?geckoId=${gecko.id}`}><GitBranch className="w-4 h-4 mr-1.5" /> Family tree</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to={`${createPageUrl('Lineage')}?geckoId=${gecko.id}`}>Lineage chart</Link>
        </Button>
        {canEdit && (
          <Button asChild size="sm" variant="outline">
            <Link to={calculatorLink(gecko)}>Pair in calculator</Link>
          </Button>
        )}
      </div>
      {offspringCount > 0 && (
        <p className="text-xs text-slate-400">
          {offspringCount} offspring recorded, listed under Breeding.
        </p>
      )}
    </RecordCard>
  );
}

/** Hatch date, incubation, tail, gravid dates, morph tags and notes. */
export function DetailsCard({ gecko, headingAs }) {
  const rows = [
    gecko.hatch_date && ['Hatched', day(gecko.hatch_date, 'MMMM d, yyyy')],
    gecko.incubation_days && ['Incubation', `${gecko.incubation_days} days`],
    gecko.tail_status && ['Tail', String(gecko.tail_status).replace(/^\w/, (c) => c.toUpperCase())],
    gecko.sex === 'Female' && gecko.is_gravid && gecko.gravid_since && ['Gravid since', day(gecko.gravid_since)],
    gecko.sex === 'Female' && gecko.is_gravid && gecko.egg_drop_date && ['Eggs due', day(gecko.egg_drop_date)],
  ].filter(Boolean);
  const tags = Array.isArray(gecko.morph_tags) ? gecko.morph_tags : [];
  if (!rows.length && !tags.length && !gecko.notes) return null;
  return (
    <RecordCard id="details" icon={Info} title="Details" headingAs={headingAs} contentClassName="space-y-3">
      {rows.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-slate-400 text-xs">{label}</dt>
              <dd className="text-slate-200 font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="outline" className="border-emerald-700 text-emerald-300 text-xs">{formatHetTag(tag)}</Badge>
          ))}
        </div>
      )}
      {gecko.notes && (
        <div>
          <p className="text-slate-400 text-xs">Notes</p>
          <p className="text-slate-300 text-sm whitespace-pre-wrap mt-0.5">{gecko.notes}</p>
        </div>
      )}
    </RecordCard>
  );
}

/**
 * Feeding and shed history for a keeper (the same log Field Mode, Batch
 * Husbandry and Mark fed write), or just the next shed window for anyone
 * else (the passport shows buyers the feeding history).
 */
export function CareSection({ gecko, keeper, weights, legacyEvents, refreshKey, shedForecast, headingAs }) {
  if (keeper) {
    return (
      <RecordCard id="care" icon={Utensils} title="Feeding and sheds" headingAs={headingAs}>
        <HusbandryHistory
          gecko={gecko}
          weights={weights}
          refreshKey={refreshKey}
          legacyEvents={legacyEvents}
          headingClassName={HEADING_CLASS.replace('text-base', 'text-sm')}
          iconClassName={ICON_CLASS}
        />
      </RecordCard>
    );
  }
  if (!shedForecast) return null;
  const confidence = {
    high: 'bg-emerald-900/60 text-emerald-200 border-emerald-700/60',
    medium: 'bg-amber-900/60 text-amber-200 border-amber-700/60',
    low: 'bg-slate-800 text-slate-300 border-slate-600',
  };
  return (
    <RecordCard id="care" icon={Droplets} title="Next shed window" headingAs={headingAs}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-lg font-semibold text-slate-100">{formatShedWindow(shedForecast)}</span>
        <Badge variant="outline" className={`${confidence[shedForecast.confidence] || confidence.low} capitalize`}>
          {shedForecast.confidence} confidence
        </Badge>
      </div>
      <p className="text-xs text-slate-400 mt-1.5">{shedForecast.basis}</p>
    </RecordCard>
  );
}

/** Vet visits: logged here, shown on the passport, with a follow-up reminder. */
export function VetSection({ gecko, canEdit, currentUserEmail, headingAs }) {
  return (
    <RecordCard id="vet">
      <VetRecordsSection
        gecko={gecko}
        canEdit={canEdit}
        currentUserEmail={currentUserEmail}
        headingAs={headingAs}
        headingClassName={HEADING_CLASS}
        iconClassName={ICON_CLASS}
      />
    </RecordCard>
  );
}

const EVENT_ICONS = {
  shed: Droplets,
  feeding: Utensils,
  bug_feeding: Bug,
  cage_cleaning: Brush,
  custom: PenLine,
};

const eventLabel = (event) => {
  if (event.event_type === 'custom') return event.custom_event_name || 'Custom event';
  const text = String(event.event_type || 'event').replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const eventWhen = (value) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? format(d, 'MMM d, yyyy h:mm a') : '';
};

/** The general event log, and who did what in a shared collection. */
export function HistorySection({ gecko, events, currentUserEmail, guest, headingAs }) {
  return (
    <RecordCard id="history" icon={History} title="Event history" headingAs={headingAs} contentClassName="space-y-4">
      {events.length > 0 ? (
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {events.map((event) => {
            const Icon = EVENT_ICONS[event.event_type] || ClipboardList;
            return (
              <li key={event.id} className="bg-slate-800 p-3 rounded-lg">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-slate-200 font-medium text-sm min-w-0">
                    <Icon className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                    <span className="truncate">{eventLabel(event)}</span>
                  </span>
                  <span className="text-slate-400 text-xs shrink-0">{eventWhen(event.event_date)}</span>
                </div>
                {event.notes && <p className="text-slate-400 text-xs mt-1">{event.notes}</p>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-slate-400 text-sm">No events logged yet. Use Log event at the top to add one.</p>
      )}
      {/* Who did what, when this gecko sits in a shared collection.
          Renders nothing for geckos that were never shared. */}
      {!guest && (
        <CollectionActivity geckoId={gecko.id} currentEmail={currentUserEmail} hideWhenEmpty title="Shared activity" />
      )}
    </RecordCard>
  );
}

/**
 * Hidden genetics from the lineage, the AI health check, the growth reel
 * and lookalikes. Each is metered or slow, so they wait until the member
 * scrolls this far.
 */
export function MoreSection({ gecko, weights, currentUser, headingAs: Heading = 'h3' }) {
  return (
    <section aria-labelledby={sectionId('more-heading')} id={sectionId('more')} tabIndex={-1} className="scroll-mt-28 space-y-4">
      <Heading id={sectionId('more-heading')} className="text-base font-semibold text-slate-100 flex items-center gap-2">
        <Sparkles className={ICON_CLASS} aria-hidden="true" /> More about {gecko.name || 'this gecko'}
      </Heading>
      <DeferUntilVisible minHeight={120}>
        <Suspense fallback={<div className="h-24 rounded-xl bg-slate-900 border border-slate-800 animate-pulse" />}>
          <div className="space-y-4">
            <HiddenHetPanel gecko={gecko} />
            <HealthScreenCard gecko={gecko} user={currentUser} />
            <GrowthReel gecko={gecko} weights={weights} user={currentUser} />
            <VisualSiblings gecko={gecko} user={currentUser} />
          </div>
        </Suspense>
      </DeferUntilVisible>
    </section>
  );
}

/**
 * Last on the record: making a sticker or name plaque from this gecko, and
 * the supplies suggestion. Both are offers, not records, so they never sit
 * above the gecko's own history.
 */
export function BottomOffers({ gecko, canEdit }) {
  return (
    <div className="space-y-4" data-record-offers>
      {canEdit && <StickerGeckoActions gecko={gecko} />}
      <DeferUntilVisible minHeight={1}>
        <Suspense fallback={null}>
          <RecommendedKitForGecko gecko={gecko} />
        </Suspense>
      </DeferUntilVisible>
    </div>
  );
}
