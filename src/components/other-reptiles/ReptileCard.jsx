import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Edit, Calendar } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import EventTracker from '../my-geckos/EventTracker';
import { ReptileEvent } from '@/entities/all';

const DEFAULT_IMAGE = 'https://i.imgur.com/sw9gnDp.png';

export default function ReptileCard({ reptile, onView, onEdit, onFeedingComplete }) {
    const primaryImage = reptile.image_urls && reptile.image_urls.length > 0 
        ? reptile.image_urls[0] 
        : DEFAULT_IMAGE;

    // Calculate feeding status
    const getFeedingStatus = () => {
        if (!reptile.feeding_reminder_enabled || !reptile.last_fed_date) {
            return { status: 'none', daysUntil: null, daysSince: null };
        }

        const lastFed = new Date(reptile.last_fed_date);
        const today = new Date();
        const daysSinceLastFed = differenceInDays(today, lastFed);
        const daysUntilNextFeed = reptile.feeding_interval_days - daysSinceLastFed;

        if (daysUntilNextFeed > 1) {
            return { status: 'ok', daysUntil: daysUntilNextFeed, daysSince: daysSinceLastFed };
        } else if (daysUntilNextFeed === 1 || daysUntilNextFeed === 0) {
            return { status: 'due', daysUntil: daysUntilNextFeed, daysSince: daysSinceLastFed };
        } else if (daysUntilNextFeed >= -2) {
            return { status: 'overdue', daysUntil: daysUntilNextFeed, daysSince: daysSinceLastFed };
        } else {
            return { status: 'very_overdue', daysUntil: daysUntilNextFeed, daysSince: daysSinceLastFed };
        }
    };

    const feedingStatus = getFeedingStatus();

    const getBorderClass = () => {
        if (!reptile.feeding_reminder_enabled) return 'border-slate-700';
        
        switch (feedingStatus.status) {
            case 'ok':
                return 'border-emerald-500 shadow-emerald-500/20 shadow-lg';
            case 'due':
                return 'border-yellow-500 shadow-yellow-500/30 shadow-lg animate-pulse';
            case 'overdue':
                return 'border-orange-500 shadow-orange-500/30 shadow-lg';
            case 'very_overdue':
                return 'border-red-500 shadow-red-500/40 shadow-xl animate-pulse';
            default:
                return 'border-slate-700';
        }
    };

    const getStatusBadge = () => {
        if (!reptile.feeding_reminder_enabled || feedingStatus.status === 'none') return null;

        const badges = {
            ok: { bg: 'bg-emerald-900/50', text: 'text-emerald-400', label: `Feed in ${feedingStatus.daysUntil}d` },
            due: { bg: 'bg-yellow-900/50', text: 'text-yellow-400', label: 'Feeding Day!' },
            overdue: { bg: 'bg-orange-900/50', text: 'text-orange-400', label: `${Math.abs(feedingStatus.daysUntil)}d overdue` },
            very_overdue: { bg: 'bg-red-900/50', text: 'text-red-400', label: `${Math.abs(feedingStatus.daysUntil)}d overdue!` },
        };

        const badge = badges[feedingStatus.status];
        if (!badge) return null;

        return (
            <div className={`absolute top-2 right-2 ${badge.bg} ${badge.text} px-2 py-1 rounded-full text-xs font-bold`}>
                {badge.label}
            </div>
        );
    };

    const getSexIcon = (sex) => {
        return sex === 'Male' ? '♂' : sex === 'Female' ? '♀' : '?';
    };

    const getSexColor = (sex) => {
        return sex === 'Male' ? 'text-blue-400' : sex === 'Female' ? 'text-pink-400' : 'text-gray-400';
    };

    const handleEventAdded = (eventData) => {
        if (eventData.event_type === 'feeding' && onFeedingComplete) {
            onFeedingComplete(reptile.id);
        }
    };

    return (
        <Card className={`gecko-card group overflow-hidden border-2 transition-all duration-300 ${getBorderClass()}`}>
            <div className="relative">
                <img 
                    src={primaryImage} 
                    alt={reptile.name}
                    className="w-full h-40 sm:h-56 object-cover"
                    onError={(e) => { e.target.src = DEFAULT_IMAGE; }}
                />
                
                <div className="absolute top-2 left-2 flex items-center gap-2">
                    <span className={`${getSexColor(reptile.sex)} text-3xl font-bold drop-shadow-lg`}>
                      {getSexIcon(reptile.sex)}
                    </span>
                </div>

                {getStatusBadge()}

                <div className="absolute bottom-2 right-2 flex gap-1 sm:gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Button
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onView(reptile); }}
                        className="bg-blue-600/90 hover:bg-blue-700 text-white font-semibold shadow-lg backdrop-blur-sm text-xs h-8 px-2 sm:px-4"
                    >
                        <Eye className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">View</span>
                    </Button>
                    <Button
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onEdit(reptile); }}
                        className="bg-white/90 hover:bg-white text-gray-900 font-semibold shadow-lg backdrop-blur-sm text-xs h-8 px-2 sm:px-4"
                    >
                        <Edit className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Edit</span>
                    </Button>
                </div>
            </div>

            <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base sm:text-lg text-slate-100 truncate">
                        {reptile.name}
                    </h3>
                    <EventTracker 
                        entityId={reptile.id} 
                        entityType="reptile" 
                        EventEntity={ReptileEvent}
                        onEventAdded={handleEventAdded}
                    />
                </div>
                
                <p className="text-xs text-slate-400 truncate">
                    {reptile.species} {reptile.morph && `• ${reptile.morph}`}
                </p>

                {reptile.feeding_reminder_enabled && reptile.last_fed_date && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Calendar className="w-3 h-3" />
                        <span>Last fed: {format(new Date(reptile.last_fed_date), 'MMM d')}</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}