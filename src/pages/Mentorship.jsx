import { useState, useEffect, useCallback, useMemo } from 'react';
import Seo from '@/components/seo/Seo';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import MentorOfferCard from '@/components/mentorship/MentorOfferCard';
import MentorOfferEditor from '@/components/mentorship/MentorOfferEditor';
import { GraduationCap, Plus, Sparkles } from 'lucide-react';

const TYPE_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'mentorship', label: 'Mentorship' },
    { value: 'consult', label: 'Consults' },
    { value: 'course', label: 'Courses' },
];

// Shared pill styling for the filter chips, dark slate with an emerald
// active state to match the rest of the app.
function FilterChip({ active, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                active
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-emerald-600 hover:text-emerald-300'
            }`}
        >
            {children}
        </button>
    );
}

/**
 * Mentorship marketplace, v1. Established breeders publish offers
 * (mentorship, consults, courses); keepers browse and reach out through
 * the existing in-app messaging. No payments in v1: prices are listed,
 * the arrangement itself happens directly between the two people.
 *
 * Data access goes through supabase.from('mentor_offers') directly:
 * the table has no TABLE_MAP entry in src/api/supabaseEntities.js.
 */
export default function MentorshipPage() {
    const { user, isAuthenticated, isGuest } = useAuth();
    const { toast } = useToast();
    const [offers, setOffers] = useState([]);
    const [myOffers, setMyOffers] = useState([]);
    const [profileMap, setProfileMap] = useState(() => new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('all');
    const [specialtyFilter, setSpecialtyFilter] = useState(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingOffer, setEditingOffer] = useState(null);

    const isSignedIn = isAuthenticated && !isGuest;

    const loadData = useCallback(async (isInitial = false) => {
        if (isInitial) setIsLoading(true);
        try {
            // Public read: RLS exposes active offers to everyone.
            const { data: activeOffers, error: offersError } = await supabase
                .from('mentor_offers')
                .select('*')
                .eq('is_active', true)
                .order('created_date', { ascending: false });
            if (offersError) throw offersError;
            setOffers(activeOffers || []);

            // Owner read: the signed-in user's own offers, active or not.
            // user_id on this table is the real auth uid (not the legacy
            // profiles.id), so resolve it from the live session.
            let mine = [];
            const { data: authData } = await supabase.auth.getUser();
            const authUid = authData?.user?.id;
            if (authUid) {
                const { data: ownOffers, error: mineError } = await supabase
                    .from('mentor_offers')
                    .select('*')
                    .eq('user_id', authUid)
                    .order('created_date', { ascending: false });
                if (mineError) throw mineError;
                mine = ownOffers || [];
            }
            setMyOffers(mine);

            // Resolve public display profiles for every mentor in one
            // round trip, same pattern the Messages page uses.
            const emails = [
                ...new Set(
                    [...(activeOffers || []), ...mine]
                        .map((o) => o.owner_email)
                        .filter(Boolean)
                ),
            ];
            if (emails.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('email, full_name, breeder_name, business_name, profile_image_url')
                    .in('email', emails);
                if (profiles) {
                    setProfileMap(new Map(profiles.map((p) => [p.email, p])));
                }
            }
        } catch (error) {
            console.error('Failed to load mentor offers:', error);
        }
        if (isInitial) setIsLoading(false);
    }, []);

    useEffect(() => {
        loadData(true);
    }, [loadData]);

    // Specialty chips are derived from what mentors actually offer, most
    // common first, capped so the filter row stays scannable.
    const specialtyOptions = useMemo(() => {
        const counts = new Map();
        for (const offer of offers) {
            for (const s of offer.specialties || []) {
                if (!s) continue;
                counts.set(s, (counts.get(s) || 0) + 1);
            }
        }
        return [...counts.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, 12)
            .map(([name]) => name);
    }, [offers]);

    const filteredOffers = useMemo(() => {
        return offers.filter((offer) => {
            if (typeFilter !== 'all' && offer.offer_type !== typeFilter) return false;
            if (
                specialtyFilter &&
                !(offer.specialties || []).some(
                    (s) => s.toLowerCase() === specialtyFilter.toLowerCase()
                )
            ) {
                return false;
            }
            return true;
        });
    }, [offers, typeFilter, specialtyFilter]);

    const openCreate = () => {
        setEditingOffer(null);
        setIsEditorOpen(true);
    };

    const openEdit = (offer) => {
        setEditingOffer(offer);
        setIsEditorOpen(true);
    };

    const toggleActive = async (offer) => {
        try {
            const { error } = await supabase
                .from('mentor_offers')
                .update({ is_active: !offer.is_active })
                .eq('id', offer.id);
            if (error) throw error;
            toast({
                title: offer.is_active ? 'Offer deactivated' : 'Offer reactivated',
                description: offer.is_active
                    ? 'It is hidden from the marketplace until you reactivate it.'
                    : 'Keepers can find it on the Mentorship page again.',
            });
            loadData(false);
        } catch (error) {
            console.error('Failed to toggle offer:', error);
            toast({
                title: 'Update failed',
                description: error.message || 'Please try again.',
                variant: 'destructive',
            });
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">
            <Seo
                title="Crested Gecko Mentorship & Courses"
                description="Learn from established crested gecko breeders: one-on-one mentorship, genetics consults, and courses on Lilly White lines, Axanthic projects, and more."
                path="/Mentorship"
                keywords={[
                    'crested gecko mentorship',
                    'gecko breeding mentor',
                    'genetics consult',
                    'crested gecko course',
                ]}
            />
            <div className="max-w-6xl mx-auto">
                {/* Hero */}
                <div className="mb-8">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                                    <GraduationCap className="w-6 h-6 text-white" />
                                </div>
                                <h1 className="text-3xl md:text-4xl font-bold text-slate-100">
                                    Learn from breeders who&apos;ve been there
                                </h1>
                            </div>
                            <p className="text-slate-400 max-w-2xl">
                                Crested gecko mentorship, genetics consults, and courses
                                from established keepers. Browse who is offering, message
                                them in-app, and arrange the details directly. Geck
                                Inspect does not process mentorship payments yet.
                            </p>
                        </div>
                        {isSignedIn && (
                            <Button
                                onClick={openCreate}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Offer mentorship
                            </Button>
                        )}
                    </div>
                </div>

                {isLoading ? (
                    <div className="py-24 flex justify-center">
                        <LoadingSpinner message="Loading mentors..." />
                    </div>
                ) : (
                    <>
                        {/* The signed-in user's own offers, active or not */}
                        {isSignedIn && myOffers.length > 0 && (
                            <div className="mb-10">
                                <h2 className="text-xl font-semibold text-slate-100 mb-4">
                                    Your offers
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {myOffers.map((offer) => (
                                        <MentorOfferCard
                                            key={offer.id}
                                            offer={offer}
                                            profile={profileMap.get(offer.owner_email)}
                                            currentUserEmail={user?.email}
                                            isOwner
                                            onEdit={openEdit}
                                            onToggleActive={toggleActive}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Filters */}
                        {offers.length > 0 && (
                            <div className="mb-6 space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    {TYPE_FILTERS.map((t) => (
                                        <FilterChip
                                            key={t.value}
                                            active={typeFilter === t.value}
                                            onClick={() => setTypeFilter(t.value)}
                                        >
                                            {t.label}
                                        </FilterChip>
                                    ))}
                                </div>
                                {specialtyOptions.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {specialtyOptions.map((s) => (
                                            <FilterChip
                                                key={s}
                                                active={specialtyFilter === s}
                                                onClick={() =>
                                                    setSpecialtyFilter(
                                                        specialtyFilter === s ? null : s
                                                    )
                                                }
                                            >
                                                {s}
                                            </FilterChip>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Marketplace grid */}
                        {offers.length === 0 ? (
                            <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-xl px-6">
                                <Sparkles className="w-12 h-12 mx-auto text-emerald-500 mb-4" />
                                <h2 className="text-2xl font-semibold text-slate-100 mb-2">
                                    Be a founding mentor
                                </h2>
                                <p className="text-slate-400 max-w-xl mx-auto mb-6">
                                    No offers are live yet, which means the first
                                    established breeders to list here get the whole
                                    stage. If you have raised your share of Lilly White
                                    clutches, debugged Axanthic projects, or judged
                                    structure at shows, keepers want to learn from you.
                                </p>
                                {isSignedIn ? (
                                    <Button
                                        onClick={openCreate}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Create the first offer
                                    </Button>
                                ) : (
                                    <Button
                                        asChild
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white"
                                    >
                                        <a href="/AuthPortal">Sign in to offer mentorship</a>
                                    </Button>
                                )}
                            </div>
                        ) : filteredOffers.length === 0 ? (
                            <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-xl">
                                <p className="text-slate-400">
                                    No offers match those filters yet. Try a different
                                    type or specialty.
                                </p>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setTypeFilter('all');
                                        setSpecialtyFilter(null);
                                    }}
                                    className="mt-4 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                                >
                                    Clear filters
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {filteredOffers.map((offer) => (
                                    <MentorOfferCard
                                        key={offer.id}
                                        offer={offer}
                                        profile={profileMap.get(offer.owner_email)}
                                        currentUserEmail={isSignedIn ? user?.email : null}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            <MentorOfferEditor
                open={isEditorOpen}
                onOpenChange={setIsEditorOpen}
                offer={editingOffer}
                onSaved={() => loadData(false)}
            />
        </div>
    );
}
