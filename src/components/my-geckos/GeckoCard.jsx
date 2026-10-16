import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Edit, Calendar, Weight, Heart, Users2 } from 'lucide-react';
import { format } from 'date-fns';
import WeightHealthBadge from '@/components/innovations/WeightHealthBadge';
import QualityBadge from '@/components/shared/QualityBadge';
import SmartImage from '@/components/shared/SmartImage';
import { getSexIcon, getSexColor } from '@/lib/utils';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';
import { parseLocalDate, formatAge } from '@/lib/dateUtils';
import { readinessFor, showReadinessOnCard } from '@/lib/breedingReadiness';
import { ReadinessBadge } from '@/components/breeding/BreedingReadiness';
import ArchiveStatusChip from '@/components/my-geckos/ArchiveStatusChip';


const initialsForName = (name = '') => String(name).trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'GI';
const hueForName = (name = '') => [...String(name)].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 17);

// `isOwner` controls the visual "Shared" badge (i.e. is this row in the
// caller's own collection or one shared with them). `canEdit` controls
// whether write affordances are rendered. Pre-Phase-B those were the
// same thing, post-Phase-B a collection owner can edit a gecko whose
// `created_by` is a different user, so the two diverge.
// imageWidth: the widest the card's photo is drawn, in CSS pixels. 480 (the
// default) suits My Geckos, two cards to a row on a phone and up to five on a
// wide screen, so the 480 px thumbnail covers each at twice its size. Pages
// that show one card to a row on a phone (a breeder's profile) pass more,
// which loads the full photo instead of the thumbnail.
export default function GeckoCard({ gecko, weightRecords = [], feedingGroups = [], onView, onEdit, isOwner = true, canEdit, imageWidth = 480 }) {
  const writable = canEdit !== undefined ? canEdit : isOwner;
  const feedingGroup = feedingGroups.find(g => g.id === gecko.feeding_group_id);

  const latestWeight = React.useMemo(() => {
    const geckoWeights = weightRecords.filter(w => w.gecko_id === gecko.id);
    if (geckoWeights.length === 0) return null;
    const sorted = [...geckoWeights].sort((a, b) => new Date(b.record_date) - new Date(a.record_date));
    return sorted[0]?.weight_grams;
  }, [gecko.id, weightRecords]);

  const primaryImage = gecko.image_urls?.[0] || DEFAULT_GECKO_IMAGE;
  const demoPhotoUnavailable = gecko.photo_is_illustrative && !gecko.image_urls?.[0];
  const primaryMeta = gecko.image_crop_data?.[primaryImage] || {};
  const primaryStyle = {
    objectPosition: `${primaryMeta.x ?? 50}% ${primaryMeta.y ?? 50}%`,
    transform: primaryMeta.rotation ? `rotate(${primaryMeta.rotation}deg)` : undefined,
  };

  const handleViewClick = (e) => {
    e.stopPropagation();
    if (onView) onView(gecko);
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    if (onEdit) onEdit(gecko);
  };

  const showSpeciesBadge = gecko.species && gecko.species !== 'Crested Gecko';
  const showGravidBadge = gecko.sex === 'Female' && gecko.is_gravid;
  const archiveReason = gecko.archived ? gecko.archive_reason || 'other' : null;
  // "Intact" is the default state for most healthy geckos, so we only flag
  // the deviations from it on the card. NULL stays silent.
  const showTailBadge = gecko.tail_status === 'dropped' || gecko.tail_status === 'regenerating';
  const tailBadgeLabel = gecko.tail_status === 'dropped' ? 'Tail dropped' : 'Regen tail';
  const readiness = React.useMemo(() => readinessFor(gecko, weightRecords), [gecko, weightRecords]);
  const showReadiness = showReadinessOnCard(gecko, readiness);

  const photo = demoPhotoUnavailable ? (
    <div
      className="w-full h-40 sm:h-56 flex flex-col items-center justify-center text-white"
      style={{ background: `radial-gradient(circle at 70% 25%, hsl(${hueForName(gecko.name)} 52% 38%), hsl(${hueForName(gecko.name)} 42% 16%))` }}
      role="img"
      aria-label={`${gecko.name}, no illustrative photo assigned`}
    >
      <span className="text-4xl font-semibold tracking-wide opacity-90">{initialsForName(gecko.name)}</span>
      <span className="mt-2 rounded bg-slate-950/70 px-2 py-1 text-[10px] font-semibold">No photo</span>
    </div>
  ) : (
    <SmartImage
      gecko={gecko}
      src={primaryImage}
      alt={gecko.photo_is_illustrative ? `${gecko.name}, illustrative photo, not this demo animal` : gecko.name}
      width={imageWidth}
      aspect="auto"
      containerClassName="w-full h-40 sm:h-56"
      className="w-full h-full object-cover"
      style={primaryStyle}
      fallback={DEFAULT_GECKO_IMAGE}
    />
  );

  return (
    <Card className="gecko-card group flex flex-col h-full">
      {/* Image area. Corners are clipped by the parent .gecko-card's
          overflow:hidden + 9px radius, so no inner radius needed. */}
      <div className="relative">
        {/* Tapping the photo opens the full record (the guest tour says
            "Tap any gecko's photo for its full record"). It is a button of
            its own, with the badges and the View and Edit buttons beside it
            rather than inside it, so those keep doing only their own job.
            The labels that only show information let a tap through to it. */}
        {onView ? (
          <button
            type="button"
            onClick={handleViewClick}
            aria-label={`Open ${gecko.name ? `${gecko.name}'s` : "this gecko's"} record`}
            className="block w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400"
          >
            {photo}
          </button>
        ) : photo}

        {/* Top-left: bare sex symbol + feeding group pill (aligned heights) */}
        <div className="pointer-events-none absolute top-2 left-2 flex items-center gap-1.5">
          <span
            className={`inline-flex items-center justify-center h-6 text-lg font-bold leading-none ${getSexColor(gecko.sex)}`}
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.7)' }}
            aria-label={gecko.sex || 'Unknown sex'}
          >
            {getSexIcon(gecko.sex)}
          </span>
          {!gecko.archived && feedingGroup && (
            <span
              className="pointer-events-auto inline-flex items-center justify-center h-6 w-6 rounded-full text-white text-[11px] font-bold shadow border border-white/30 leading-none"
              style={{ backgroundColor: feedingGroup.color || '#f97316' }}
              title={`Feeding Group ${feedingGroup.label || ''}${feedingGroup.name ? ': ' + feedingGroup.name : ''}${feedingGroup.diet_type ? ', ' + feedingGroup.diet_type : ''}`}
            >
              {feedingGroup.label}
            </span>
          )}
        </div>

        {gecko.photo_is_illustrative && !demoPhotoUnavailable && (
          <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-slate-950/85 px-2 py-1 text-[10px] font-semibold text-white shadow">
            Illustrative photo
            <span className="block text-[9px] font-normal text-slate-200">Not the sample animal</span>
          </span>
        )}

        {/* Top-right: archive reason or quality badge */}
        {archiveReason ? (
          <ArchiveStatusChip reason={archiveReason} className="pointer-events-none absolute top-2 right-2 shadow" />
        ) : gecko.quality_score != null ? (
          <div className="absolute top-2 right-2 drop-shadow-lg">
            <QualityBadge score={gecko.quality_score} size="sm" />
          </div>
        ) : null}

        {/* Bottom-right: actions (always visible on touch; on desktop they
            show on hover, or while the keyboard is on the card) */}
        <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity duration-200">
          <Button
            size="sm"
            onClick={handleViewClick}
            aria-label={`View ${gecko.name || 'gecko'}`}
            className="h-8 px-2.5 touch:min-h-11 touch:min-w-11 bg-slate-900/75 hover:bg-slate-800/85 text-emerald-300 border border-emerald-600/40 backdrop-blur-sm font-medium"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline ml-1.5 text-xs">View</span>
          </Button>
          {writable && (
            <Button
              size="sm"
              onClick={handleEditClick}
              aria-label={`Edit ${gecko.name || 'gecko'}`}
              className="h-8 px-2.5 touch:min-h-11 touch:min-w-11 bg-slate-900/75 hover:bg-slate-800/85 text-emerald-300 border border-emerald-600/40 backdrop-blur-sm font-medium"
            >
              <Edit className="w-3.5 h-3.5" />
              <span className="hidden sm:inline ml-1.5 text-xs">Edit</span>
            </Button>
          )}
        </div>
      </div>

      {/* Body, flex column so cards in a grid share the same baseline */}
      <CardContent className="p-3 flex-1 flex flex-col gap-1.5">
        <div className="min-w-0">
          <h3 className="font-bold text-base sm:text-lg text-emerald-100 truncate leading-tight">
            {gecko.name}
          </h3>
          {gecko.gecko_id_code && (
            <p className="mt-0.5 text-[11px] text-slate-500 font-mono uppercase tracking-wider truncate">
              {gecko.gecko_id_code}
            </p>
          )}
          {!isOwner && (
            <Badge
              className="mt-1 bg-blue-900/40 text-blue-200 border border-blue-700/50 text-[10px] inline-flex items-center gap-1 max-w-full"
              title={`Shared by ${gecko.created_by || 'another keeper'}`}
            >
              <Users2 className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="truncate">Shared</span>
            </Badge>
          )}
        </div>

        {/* Stats row, left-aligned, wraps when narrow, never jumps */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm mt-auto">
          {latestWeight != null && (
            <div className="inline-flex items-center gap-1 text-emerald-400">
              <Weight className="w-3 h-3 shrink-0" />
              <span className="font-semibold">{latestWeight}g</span>
              <WeightHealthBadge weightRecords={weightRecords.filter(w => w.gecko_id === gecko.id)} />
            </div>
          )}
          {gecko.hatch_date && (
            <div className="inline-flex items-center gap-1 text-slate-400">
              <Calendar className="w-3 h-3 shrink-0" />
              <span>{format(parseLocalDate(gecko.hatch_date), 'MM/dd/yy')}</span>
              {formatAge(gecko.hatch_date) && (
                <span className="text-slate-500">· {formatAge(gecko.hatch_date)}</span>
              )}
            </div>
          )}
        </div>

        {/* Status badges, inline so they don't stack as detached chunks */}
        {(showGravidBadge || showSpeciesBadge || showTailBadge || showReadiness) && (
          <div className="flex flex-wrap gap-1.5">
            {showReadiness && <ReadinessBadge readiness={readiness} />}
            {showGravidBadge && (
              <Badge className="bg-pink-700 text-pink-100 text-[10px] h-5 px-1.5 py-0 font-medium flex items-center gap-1">
                <Heart className="w-2.5 h-2.5" /> Gravid
              </Badge>
            )}
            {showTailBadge && (
              <Badge
                className={`text-[10px] h-5 px-1.5 py-0 font-medium ${
                  gecko.tail_status === 'dropped'
                    ? 'bg-amber-900/60 text-amber-200 border border-amber-700/60'
                    : 'bg-sky-900/60 text-sky-200 border border-sky-700/60'
                }`}
                title={gecko.tail_status === 'dropped' ? 'Tail has been dropped (crested geckos do not regrow tails)' : 'Tail is regenerating'}
              >
                {tailBadgeLabel}
              </Badge>
            )}
            {showSpeciesBadge && (
              <Badge className="bg-teal-900 text-teal-300 border border-teal-700 text-[10px] h-5 px-1.5 py-0 font-medium">
                {gecko.species}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
