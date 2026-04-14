import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { OtherReptile, Notification } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { PlusCircle, Search, Users, Archive, ArchiveRestore, Lock } from 'lucide-react';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReptileCard from '../components/other-reptiles/ReptileCard';
import ReptileForm from '../components/other-reptiles/ReptileForm';
import ReptileDetailModal from '../components/other-reptiles/ReptileDetailModal';
import PlanLimitModal, { checkPlanLimit, getOtherReptileLimit } from '@/components/subscription/PlanLimitChecker';
import PageSettingsPanel from '@/components/ui/PageSettingsPanel';
import { toast } from '@/components/ui/use-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { differenceInDays } from 'date-fns';

export default function OtherReptilesPage() {
    const [reptiles, setReptiles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedReptile, setSelectedReptile] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [showLimitModal, setShowLimitModal] = useState(false);

    // Check and create feeding notifications for overdue/due reptiles
    const checkFeedingNotifications = useCallback(async (reptileList, userEmail) => {
        const today = new Date();
        
        for (const reptile of reptileList) {
            if (!reptile.feeding_reminder_enabled || !reptile.last_fed_date || !reptile.feeding_interval_days) {
                continue;
            }

            const lastFed = new Date(reptile.last_fed_date);
            const daysSinceLastFed = differenceInDays(today, lastFed);
            const daysUntilNextFeed = reptile.feeding_interval_days - daysSinceLastFed;

            // Only create notification if overdue or due today
            if (daysUntilNextFeed <= 0 && reptile.feeding_notification_enabled) {
                const todayStr = today.toISOString().split('T')[0];
                
                // Check if we already sent a notification today for this reptile
                try {
                    const existingNotifs = await Notification.filter({ 
                        user_email: userEmail
                    });
                    
                    const alreadyNotified = existingNotifs.some(n => 
                        n.metadata?.reptile_id === reptile.id && 
                        n.metadata?.type === 'feeding_reminder' &&
                        n.created_date?.startsWith(todayStr)
                    );

                    if (!alreadyNotified) {
                        const daysOverdue = Math.abs(daysUntilNextFeed);
                        const message = daysOverdue === 0 
                            ? `${reptile.name} (${reptile.species}) is due for feeding today!`
                            : `${reptile.name} (${reptile.species}) is ${daysOverdue} day(s) overdue for feeding!`;

                        await Notification.create({
                            user_email: userEmail,
                            type: 'announcement',
                            content: message,
                            link: '/OtherReptiles',
                            metadata: { reptile_id: reptile.id, type: 'feeding_reminder' }
                        });
                    }
                } catch (e) {
                    // Silently fail - notifications are not critical
                    console.log("Could not check/create feeding notification:", e);
                }
            }
        }
    }, []);

    const loadReptiles = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const userReptiles = await OtherReptile.filter({ created_by: user.email }, '-created_date');
            setReptiles(userReptiles);
            
            // Check for feeding notifications (non-blocking)
            checkFeedingNotifications(userReptiles, user.email).catch(() => {});
        } catch (error) {
            console.error("Failed to load reptiles:", error);
        }
        setIsLoading(false);
    }, [user, checkFeedingNotifications]);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const currentUser = await base44.auth.me();
                setUser(currentUser);
            } catch (error) {
                console.error("Failed to load user:", error);
                setUser(null);
                setIsLoading(false);
            }
        };
        fetchUser();
    }, []);

    useEffect(() => {
        if (user) {
            loadReptiles();
        }
    }, [user, loadReptiles]);

    const handleEdit = (reptile) => {
        setSelectedReptile(reptile);
        setIsFormOpen(true);
    };

    const handleView = (reptile) => {
        setSelectedReptile(reptile);
        setIsDetailModalOpen(true);
    };

    const handleCloseDetailModal = () => {
        setIsDetailModalOpen(false);
        setSelectedReptile(null);
        loadReptiles();
    };

    const handleDelete = async (reptileId) => {
        try {
            await OtherReptile.delete(reptileId);
            setReptiles(prev => prev.filter(r => r.id !== reptileId));
            setSelectedReptile(null);
            setIsFormOpen(false);
            toast({ title: "Reptile Deleted", description: "Successfully removed from your collection." });
        } catch (error) {
            console.error("Failed to delete reptile:", error);
            toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
        }
    };

    const handleArchive = async (reptileId, shouldArchive) => {
        try {
            await OtherReptile.update(reptileId, {
                archived: shouldArchive,
                archived_date: shouldArchive ? new Date().toISOString().split('T')[0] : null
            });
            await loadReptiles();
            setIsDetailModalOpen(false);
            setSelectedReptile(null);
            toast({ title: shouldArchive ? "Reptile archived" : "Reptile unarchived" });
        } catch (error) {
            console.error("Failed to archive reptile:", error);
            toast({ title: "Error", description: "Failed to archive.", variant: "destructive" });
        }
    };

    const handleFormSubmit = async () => {
        setIsFormOpen(false);
        setSelectedReptile(null);
        await loadReptiles();
    };

    const handleFeedingComplete = async (reptileId) => {
        try {
            await OtherReptile.update(reptileId, {
                last_fed_date: new Date().toISOString().split('T')[0]
            });
            await loadReptiles();
            toast({ title: "Feeding Recorded", description: "Last fed date updated!" });
        } catch (error) {
            console.error("Failed to update feeding:", error);
        }
    };

    // Helper function to calculate feeding priority for sorting
    const getFeedingPriority = (reptile) => {
        if (!reptile.feeding_reminder_enabled || !reptile.last_fed_date) {
            return { priority: 3, daysUntil: Infinity }; // No feeding tracking - lowest priority
        }

        const lastFed = new Date(reptile.last_fed_date);
        const today = new Date();
        const daysSinceLastFed = Math.floor((today - lastFed) / (1000 * 60 * 60 * 24));
        const daysUntilNextFeed = (reptile.feeding_interval_days || 7) - daysSinceLastFed;

        if (daysUntilNextFeed < 0) {
            // Overdue - highest priority (sort by most overdue first)
            return { priority: 0, daysUntil: daysUntilNextFeed };
        } else if (daysUntilNextFeed <= 1) {
            // Due today or tomorrow - second priority
            return { priority: 1, daysUntil: daysUntilNextFeed };
        } else {
            // Not due yet - sort by soonest to latest
            return { priority: 2, daysUntil: daysUntilNextFeed };
        }
    };

    const filteredReptiles = reptiles
        .filter(reptile => showArchived ? reptile.archived : !reptile.archived)
        .filter(reptile =>
            reptile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            reptile.species?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            reptile.morph?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            const aPriority = getFeedingPriority(a);
            const bPriority = getFeedingPriority(b);
            
            // First sort by priority group
            if (aPriority.priority !== bPriority.priority) {
                return aPriority.priority - bPriority.priority;
            }
            
            // Within same priority, sort by days until next feed
            return aPriority.daysUntil - bPriority.daysUntil;
        });

    if (!user && !isLoading) {
        const LoginPortal = React.lazy(() => import('../components/auth/LoginPortal'));
        return (
            <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><LoadingSpinner /></div>}>
                <LoginPortal requiredFeature="Other Reptiles Collection" />
            </Suspense>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-4xl font-bold text-slate-100">
                            {showArchived ? 'Archived Reptiles' : 'Other Reptiles'}
                        </h1>
                        <p className="text-slate-400 mt-1">Track your non-gecko reptile collection with feeding reminders.</p>
                    </div>
                    <div className="flex gap-2">
                        <PageSettingsPanel title="Reptile Settings">
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                                Default sort order for other reptiles can be changed in the main Settings page.
                            </p>
                        </PageSettingsPanel>
                        <Button
                            variant="outline"
                            onClick={() => setShowArchived(!showArchived)}
                            className="border-slate-600 hover:bg-slate-800"
                        >
                            {showArchived ? (
                                <>
                                    <ArchiveRestore className="w-5 h-5 mr-2" />
                                    Active
                                </>
                            ) : (
                                <>
                                    <Archive className="w-5 h-5 mr-2" />
                                    Archive
                                </>
                            )}
                        </Button>
                        {!showArchived && (
                            <Button
                                onClick={() => {
                                    // Enforce per-tier limit. Active (non-archived)
                                    // reptiles count toward the cap.
                                    const activeCount = reptiles.filter(r => !r.archived).length;
                                    const check = checkPlanLimit(user, 'other_reptiles', activeCount);
                                    if (!check.allowed) {
                                        setShowLimitModal(true);
                                        return;
                                    }
                                    setSelectedReptile(null);
                                    setIsFormOpen(true);
                                }}
                            >
                                <PlusCircle className="w-5 h-5 mr-2" />
                                Add Reptile
                            </Button>
                        )}
                    </div>
                </div>

                {(() => {
                    const activeCount = reptiles.filter(r => !r.archived).length;
                    const limit = getOtherReptileLimit(user);
                    if (!Number.isFinite(limit)) return null;
                    return (
                        <div className="mb-4 text-xs text-slate-400 flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5" />
                            <span>
                                {activeCount} / {limit} additional reptiles tracked on your plan.
                            </span>
                        </div>
                    );
                })()}

                <div className="mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input
                            type="text"
                            placeholder="Search by name, species, or morph..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 bg-slate-900 border-slate-700 text-white"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center py-20">
                        <LoadingSpinner />
                    </div>
                ) : (
                    <>
                        {!isFormOpen && (
                            filteredReptiles.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                    <AnimatePresence>
                                        {filteredReptiles.map(reptile => (
                                            <motion.div
                                                key={reptile.id}
                                                layout
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                            >
                                                <ReptileCard
                                                    reptile={reptile}
                                                    onView={handleView}
                                                    onEdit={handleEdit}
                                                    onFeedingComplete={handleFeedingComplete}
                                                />
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            ) : (
                                <EmptyState
                                    icon={Users}
                                    title="No Reptiles Found"
                                    message="Add your first reptile to get started!"
                                />
                            )
                        )}

                        <AnimatePresence>
                            {isFormOpen && (
                                <ReptileForm
                                    reptile={selectedReptile}
                                    onSubmit={handleFormSubmit}
                                    onCancel={() => { setIsFormOpen(false); setSelectedReptile(null); }}
                                    onDelete={handleDelete}
                                />
                            )}
                        </AnimatePresence>

                        {isDetailModalOpen && selectedReptile && (
                            <ReptileDetailModal
                                reptile={selectedReptile}
                                onClose={handleCloseDetailModal}
                                onUpdate={loadReptiles}
                                onEdit={(reptile) => {
                                    setIsDetailModalOpen(false);
                                    setSelectedReptile(reptile);
                                    setIsFormOpen(true);
                                }}
                                onArchive={handleArchive}
                            />
                        )}
                    </>
                )}
            </div>
            <PlanLimitModal
                isOpen={showLimitModal}
                onClose={() => setShowLimitModal(false)}
                limitType="other_reptiles"
                currentCount={reptiles.filter(r => !r.archived).length}
            />
        </div>
    );
}