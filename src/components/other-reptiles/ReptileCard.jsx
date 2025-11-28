import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Edit, Calendar, Utensils } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import EventTracker from '../my-geckos/EventTracker';
import { ReptileEvent, OtherReptile } from '@/entities/all';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DEFAULT_IMAGE = 'https://i.imgur.com/sw9gnDp.png';

export default function ReptileCard({ reptile, onView, onEdit, onFeedingComplete }) {
    const [showFedModal, setShowFedModal] = useState(false);
    const [preyType, setPreyType] = useState('');
    const [preyWeight, setPreyWeight] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const primaryImage = reptile.image_urls && reptile.image_urls.length > 0 
        ? reptile.image_urls[0] 
        : DEFAULT_IMAGE;

    // Calculate feeding status
    const getFeedingStatus = () => {
        if (!reptile.feeding_reminder_enabled || !reptile.last_fed_date) {
            return { status: 'none', daysUntil: null, daysSince: null, daysOverdue: 0 };
        }

        const lastFed = new Date(reptile.last_fed_date);
        const today = new Date();
        const daysSinceLastFed = differenceInDays(today, lastFed);
        const daysUntilNextFeed = reptile.feeding_interval_days - daysSinceLastFed;
        const daysOverdue = Math.abs(daysUntilNextFeed);

        if (daysUntilNextFeed > 1) {
            return { status: 'ok', daysUntil: daysUntilNextFeed, daysSince: daysSinceLastFed, daysOverdue: 0 };
        } else if (daysUntilNextFeed === 1 || daysUntilNextFeed === 0) {
            return { status: 'due', daysUntil: daysUntilNextFeed, daysSince: daysSinceLastFed, daysOverdue: 0 };
        } else if (daysOverdue <= 2) {
            return { status: 'overdue_minor', daysUntil: daysUntilNextFeed, daysSince: daysSinceLastFed, daysOverdue };
        } else if (daysOverdue <= 4) {
            return { status: 'overdue_orange', daysUntil: daysUntilNextFeed, daysSince: daysSinceLastFed, daysOverdue };
        } else {
            return { status: 'overdue_red', daysUntil: daysUntilNextFeed, daysSince: daysSinceLastFed, daysOverdue };
        }
    };

    const feedingStatus = getFeedingStatus();

    const needsFeeding = ['due', 'overdue_minor', 'overdue_orange', 'overdue_red'].includes(feedingStatus.status);

    const getBorderClass = () => {
        if (!reptile.feeding_reminder_enabled) return 'border-slate-700';
        
        switch (feedingStatus.status) {
            case 'ok':
                return 'border-emerald-500 shadow-emerald-500/20 shadow-lg';
            case 'due':
                return 'border-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.8)] animate-glow-feeding';
            case 'overdue_minor':
                return 'border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.6)] animate-glow-slow';
            case 'overdue_orange':
                return 'border-orange-500 shadow-[0_0_35px_rgba(249,115,22,0.7)] animate-glow-slow';
            case 'overdue_red':
                return 'border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.8)] animate-glow-slow';
            default:
                return 'border-slate-700';
        }
    };



    const handleQuickFed = async () => {
        setIsSaving(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            
            // Create feeding event
            const notes = [
                preyType && `Prey: ${preyType}`,
                preyWeight && `Weight: ${preyWeight}g`
            ].filter(Boolean).join(', ');

            await ReptileEvent.create({
                reptile_id: reptile.id,
                event_type: 'feeding',
                event_date: new Date().toISOString(),
                notes: notes || undefined
            });

            // Update last fed date
            await OtherReptile.update(reptile.id, { last_fed_date: today });

            setShowFedModal(false);
            setPreyType('');
            setPreyWeight('');
            
            if (onFeedingComplete) {
                onFeedingComplete(reptile.id);
            }
        } catch (error) {
            console.error('Failed to log feeding:', error);
        } finally {
            setIsSaving(false);
        }
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
        <>
            <style>{`
                @keyframes glow-slow {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
                .animate-glow-slow {
                    animation: glow-slow 4s ease-in-out infinite;
                }
                @keyframes glow-feeding {
                    0%, 100% { 
                        opacity: 1;
                        box-shadow: 0 0 40px rgba(250,204,21,0.8), 0 0 60px rgba(250,204,21,0.4);
                    }
                    50% { 
                        opacity: 0.7;
                        box-shadow: 0 0 20px rgba(250,204,21,0.5), 0 0 30px rgba(250,204,21,0.2);
                    }
                }
                .animate-glow-feeding {
                    animation: glow-feeding 3s ease-in-out infinite;
                }
            `}</style>
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

                    {/* Status badge and Fed button stacked */}
                    {reptile.feeding_reminder_enabled && feedingStatus.status !== 'none' && (
                        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                            <div className={`${
                                feedingStatus.status === 'ok' ? 'bg-emerald-900/50 text-emerald-400' :
                                feedingStatus.status === 'due' || feedingStatus.status === 'overdue_minor' ? 'bg-yellow-900/50 text-yellow-400' :
                                feedingStatus.status === 'overdue_orange' ? 'bg-orange-900/50 text-orange-400' :
                                'bg-red-900/50 text-red-400'
                            } px-2 py-1 rounded-full text-xs font-bold`}>
                                {feedingStatus.status === 'ok' ? `Feed in ${feedingStatus.daysUntil}d` :
                                 feedingStatus.status === 'due' ? 'Feeding Day!' :
                                 `${feedingStatus.daysOverdue}d overdue${feedingStatus.status === 'overdue_red' ? '!' : ''}`}
                            </div>
                            {needsFeeding && (
                                <Button
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); setShowFedModal(true); }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg text-xs h-7 px-3"
                                >
                                    <Utensils className="w-3 h-3 mr-1" />
                                    Fed
                                </Button>
                            )}
                        </div>
                    )}

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

        {/* Fed Modal */}
        <Dialog open={showFedModal} onOpenChange={setShowFedModal}>
            <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-sm">
                <DialogHeader>
                    <DialogTitle>Log Feeding for {reptile.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label className="text-slate-300">Prey Type</Label>
                        <Select value={preyType} onValueChange={setPreyType}>
                            <SelectTrigger className="bg-slate-800 border-slate-600">
                                <SelectValue placeholder="Select prey type (optional)" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                <SelectItem value="mouse_pinky">Mouse - Pinky</SelectItem>
                                <SelectItem value="mouse_fuzzy">Mouse - Fuzzy</SelectItem>
                                <SelectItem value="mouse_hopper">Mouse - Hopper</SelectItem>
                                <SelectItem value="mouse_adult">Mouse - Adult</SelectItem>
                                <SelectItem value="rat_pinky">Rat - Pinky</SelectItem>
                                <SelectItem value="rat_fuzzy">Rat - Fuzzy</SelectItem>
                                <SelectItem value="rat_pup">Rat - Pup</SelectItem>
                                <SelectItem value="rat_weaned">Rat - Weaned</SelectItem>
                                <SelectItem value="rat_small">Rat - Small</SelectItem>
                                <SelectItem value="rat_medium">Rat - Medium</SelectItem>
                                <SelectItem value="rat_large">Rat - Large</SelectItem>
                                <SelectItem value="quail">Quail</SelectItem>
                                <SelectItem value="chick">Chick</SelectItem>
                                <SelectItem value="rabbit">Rabbit</SelectItem>
                                <SelectItem value="insects">Insects</SelectItem>
                                <SelectItem value="fish">Fish</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-slate-300">Prey Weight (grams)</Label>
                        <Input
                            type="number"
                            value={preyWeight}
                            onChange={(e) => setPreyWeight(e.target.value)}
                            placeholder="Optional"
                            className="bg-slate-800 border-slate-600"
                        />
                    </div>
                </div>
                <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowFedModal(false)} className="border-slate-600">
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleQuickFed} 
                        disabled={isSaving}
                        className="bg-emerald-600 hover:bg-emerald-700"
                    >
                        {isSaving ? 'Saving...' : 'Log Feeding'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}