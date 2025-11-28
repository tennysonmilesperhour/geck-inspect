import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { OtherReptile, ReptileEvent } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { PlusCircle, Loader2, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReptileCard from '../components/other-reptiles/ReptileCard';
import ReptileForm from '../components/other-reptiles/ReptileForm';
import ReptileDetailModal from '../components/other-reptiles/ReptileDetailModal';
import { toast } from '@/components/ui/use-toast';
import { AnimatePresence, motion } from 'framer-motion';

export default function OtherReptilesPage() {
    const [reptiles, setReptiles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedReptile, setSelectedReptile] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const loadReptiles = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const userReptiles = await OtherReptile.filter({ created_by: user.email }, '-created_date');
            setReptiles(userReptiles);
        } catch (error) {
            console.error("Failed to load reptiles:", error);
        }
        setIsLoading(false);
    }, [user]);

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
        setIsFormOpen(true);
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

    const filteredReptiles = reptiles.filter(reptile =>
        reptile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reptile.species?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reptile.morph?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!user && !isLoading) {
        const LoginPortal = React.lazy(() => import('../components/auth/LoginPortal'));
        return (
            <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-12 h-12 text-emerald-500 animate-spin" /></div>}>
                <LoginPortal requiredFeature="Other Reptiles Collection" />
            </Suspense>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-4xl font-bold text-slate-100">Other Reptiles</h1>
                        <p className="text-slate-400 mt-1">Track your non-gecko reptile collection with feeding reminders.</p>
                    </div>
                    <Button 
                        className="bg-emerald-600 hover:bg-emerald-700" 
                        onClick={() => { setSelectedReptile(null); setIsFormOpen(true); }}
                    >
                        <PlusCircle className="w-5 h-5 mr-2" />
                        Add Reptile
                    </Button>
                </div>

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
                        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto" />
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
                                <div className="text-center py-20 bg-slate-900 rounded-lg">
                                    <Users className="w-16 h-16 mx-auto text-slate-500 mb-4" />
                                    <h3 className="text-xl font-semibold text-slate-300">No Reptiles Found</h3>
                                    <p className="text-slate-400 mt-2">Add your first reptile to get started!</p>
                                </div>
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
                    </>
                )}
            </div>
        </div>
    );
}