import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Edit, Calendar, Weight, Heart, Users2 } from 'lucide-react';
import { format } from 'date-fns';
import WeightHealthBadge from '@/components/innovations/WeightHealthBadge';
import { getSexIcon, getSexColor } from '@/lib/utils';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';

const ARCHIVE_ICONS = {
  death: '💀',
  sold: '💵',
  other: '📋',
};

const ARCHIVE_LABELS = {
  death: 'Passed Away',
  sold: 'Sold',
  other: 'Other',
};

export default function GeckoCard({ gecko, weightRecords = [], feedingGroups = [], onView, onEdit, isOwner = true }) {
  const feedingGroup = feedingGroups.find(g => g.id === gecko.feeding_group_id);

  const latestWeight = React.useMemo(() => {
    const geckoWeights = weightRecords.filter(w => w.gecko_id === gecko.id);
    if (geckoWeights.length === 0) return null;
    const sorted = [...geckoWeights].sort((a, b) => new Date(b.record_date) - new Date(a.record_date));
    return sorted[0]?.weight_grams;
  }, [gecko.id, weightRecords]);

  const primaryImage = gecko.image_urls?.[0] || DEFAULT_GECKO_IMAGE;

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
  const archiveIcon = gecko.archived ? ARCHIVE_ICONS[gecko.archive_reason] : null;

  return (
    <Card className="gecko-card group flex flex-col">
      {/* Image area */}
      <div className="relative overflow-hidden rounded-t-[18px]">
        <img
          src={primaryImage}
          alt={gecko.name}
          className="w-full h-40 sm:h-56 object-cover"
          loading="lazy"
          decoding="async"
          onError={(e) => { e.target.src = DEFAULT_GECKO_IMAGE; }}
        />

        {/* Top-left: sex pill + feeding group pill (matched heights) */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span
            className={`inline-flex items-center justify-center h-6 min-w-[26px] px-1.5 rounded-full border border-white/15 bg-slate-900/60 backdrop-blur-sm text-sm font-bold leading-none drop-shadow ${getSexColor(gecko.sex)}`}
            aria-label={gecko.sex || 'Unknown sex'}
          >
            {getSexIcon(gecko.sex)}
          </span>
          {!gecko.archived && feedingGroup && (
            <span
              className="inline-flex items-center justify-center h-6 w-6 rounded-full text-white text-[11px] font-bold shadow border border-white/30 leading-none"
              style={{ backgroundColor: feedingGroup.color || '#f97316' }}
              title={`Feeding Group ${feedingGroup.label}${feedingGroup.name ? ': ' + feedingGroup.name : ''} — ${feedingGroup.diet_type}`}
            >
              {feedingGroup.label}
            </span>
          )}
        </div>

        {/* Top-right: archive reason */}
        {archiveIcon && (
          <div
            className="absolute top-2 right-2 text-2xl leading-none drop-shadow-lg"
            title={`Archive reason: ${ARCHIVE_LABELS[gecko.archive_reason]}`}
          >
            {archiveIcon}
          </div>
        )}

        {/* Bottom-right: actions (always visible on touch, hover-only on desktop) */}
        <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
          <Button
            size="sm"
            onClick={handleViewClick}
            className="h-8 px-2.5 bg-slate-900/75 hover:bg-slate-800/85 text-emerald-300 border border-emerald-600/40 backdrop-blur-sm font-medium"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline ml-1.5 text-xs">View</span>
          </Button>
          {isOwner && (
            <Button
              size="sm"
              onClick={handleEditClick}
              className="h-8 px-2.5 bg-slate-900/75 hover:bg-slate-800/85 text-emerald-300 border border-emerald-600/40 backdrop-blur-sm font-medium"
            >
              <Edit className="w-3.5 h-3.5" />
              <span className="hidden sm:inline ml-1.5 text-xs">Edit</span>
            </Button>
          )}
        </div>
      </div>

      {/* Body — flex column so cards in a grid share the same baseline */}
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

        {/* Stats row — left-aligned, wraps when narrow, never jumps */}
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
              <span>{format(new Date(gecko.hatch_date), 'MM/dd/yy')}</span>
            </div>
          )}
        </div>

        {/* Status badges — inline so they don't stack as detached chunks */}
        {(showGravidBadge || showSpeciesBadge) && (
          <div className="flex flex-wrap gap-1.5">
            {showGravidBadge && (
              <Badge className="bg-pink-700 text-pink-100 text-[10px] h-5 px-1.5 py-0 font-medium flex items-center gap-1">
                <Heart className="w-2.5 h-2.5" /> Gravid
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
