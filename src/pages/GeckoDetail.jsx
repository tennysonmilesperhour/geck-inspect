import { useState, useEffect } from 'react';
import { initialsAvatarUrl } from '@/components/shared/InitialsAvatar';
import { Gecko, User, WeightRecord } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { breederSlug, looksLikeBreederName } from '@/lib/breederUtils';
import {
    Loader2, ArrowLeft, Calendar, GitBranch, StickyNote,
    DollarSign, LineChart as LineChartIcon, MapPin, Tag, User as UserIcon,
    ChevronLeft, ChevronRight, X
} from 'lucide-react';
import ShareMenu from '@/components/shared/ShareMenu';
import { passportUrl } from '@/lib/passportUtils';

// Renders a sire/dam parent name. If we have a linked Gecko record, that
// wins. Otherwise, if the free-text name looks like a breeder reference
// (multi-word capitalized, or has a .com suffix), link it to the public
// /Breeder page. Plain single-word nicknames render as bare text.
function ParentName({ linkedGecko, fallbackName }) {
    if (linkedGecko) return <span>{linkedGecko.name}</span>;
    const text = fallbackName || 'Unknown';
    if (!fallbackName || !looksLikeBreederName(fallbackName)) {
        return <span>{text}</span>;
    }
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import MessageUserButton from '../components/ui/MessageUserButton';
import RecommendedKitForGecko from '../components/store/RecommendedKitForGecko';

export default function GeckoDetail() {
    const [gecko, setGecko] = useState(null);
    const [sire, setSire] = useState(null);
    const [dam, setDam] = useState(null);
    const [owner, setOwner] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [weightRecords, setWeightRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lightboxIndex, setLightboxIndex] = useState(null);
    const navigate = useNavigate();

    const urlParams = new URLSearchParams(window.location.search);
    const geckoId = urlParams.get('id');

    useEffect(() => {
        const loadData = async () => {
            if (!geckoId) { setIsLoading(false); return; }
            setIsLoading(true);
            try {
                const [fetchedGecko, user] = await Promise.all([
                    Gecko.get(geckoId),
                    base44.auth.me().catch(() => null),
                ]);
                setGecko(fetchedGecko);
                setCurrentUser(user);

                // Load owner, parents, weights in parallel
                const [ownerData, weights, sireData, damData] = await Promise.allSettled([
                    fetchedGecko.created_by
                        ? User.filter({ email: fetchedGecko.created_by }).then(r => r[0] || null)
                        : Promise.resolve(null),
                    WeightRecord.filter({ gecko_id: geckoId }, 'record_date'),
                    fetchedGecko.sire_id ? Gecko.get(fetchedGecko.sire_id) : Promise.resolve(null),
                    fetchedGecko.dam_id ? Gecko.get(fetchedGecko.dam_id) : Promise.resolve(null),
                ]);

                setOwner(ownerData.status === 'fulfilled' ? ownerData.value : null);
                setWeightRecords(weights.status === 'fulfilled' ? weights.value : []);
                setSire(sireData.status === 'fulfilled' ? sireData.value : null);
                setDam(damData.status === 'fulfilled' ? damData.value : null);
            } catch (error) {
                console.error("Failed to load gecko details:", error);
            }
            setIsLoading(false);
        };
        loadData();
    }, [geckoId]);

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen bg-slate-950"><Loader2 className="w-16 h-16 animate-spin text-emerald-500" /></div>;
    }
    if (!gecko) {
        return <div className="text-center text-slate-400 p-8">Gecko not found.</div>;
    }

    const isOwner = currentUser && gecko.created_by === currentUser.email;

    // Display weight: use most recent WeightRecord as source of truth, fall back to gecko.weight_grams
    const latestWeight = weightRecords.length > 0
        ? [...weightRecords].sort((a, b) => new Date(b.record_date) - new Date(a.record_date))[0].weight_grams
        : (gecko.weight_grams ?? null);

    const chartData = [...weightRecords]
        .sort((a, b) => new Date(a.record_date) - new Date(b.record_date))
        .map(r => ({
            date: format(new Date(r.record_date), 'MMM d'),
            weight: r.weight_grams,
        }));

    const statusColors = {
        "Ready to Breed": "bg-teal-700", "Proven": "bg-emerald-700", "Holdback": "bg-blue-700",
        "For Sale": "bg-yellow-700", "Sold": "bg-gray-700", "Pet": "bg-purple-700",
        "Future Breeder": "bg-indigo-700"
    };

    return (
        <div className="bg-slate-950 min-h-screen text-slate-200">
            <div className="max-w-5xl mx-auto p-4 md:p-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <Button variant="outline" onClick={() => navigate(-1)} className="border-slate-600 hover:bg-slate-800">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    {isOwner && (
                        <Button onClick={() => navigate(createPageUrl('MyGeckos'))}>
                            Edit in My Geckos
                        </Button>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Image + basic info */}
                    <div className="space-y-4">
                        <Card className="bg-slate-900 border-slate-700 overflow-hidden">
                            <div className="aspect-square w-full bg-slate-800">
                                <img
                                    src={gecko.image_urls?.[0] || 'https://i.imgur.com/sw9gnDp.png'}
                                    alt={gecko.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <CardContent className="p-4 text-center">
                                <h1 className="text-2xl font-bold text-slate-100">{gecko.name}</h1>
                                {gecko.gecko_id_code && <p className="text-slate-400 text-sm">{gecko.gecko_id_code}</p>}
                                <div className="mt-3 flex flex-wrap justify-center gap-2">
                                    <Badge className={statusColors[gecko.status] || 'bg-slate-700'}>{gecko.status}</Badge>
                                    <Badge variant="secondary">{gecko.sex}</Badge>
                                    {latestWeight != null && <Badge variant="outline" className="border-slate-600">{latestWeight}g</Badge>}
                                </div>
                                {gecko.passport_code && (
                                  <div className="mt-3 flex justify-center">
                                    <ShareMenu
                                      url={passportUrl(gecko.passport_code)}
                                      title={`${gecko.name} on Geck Inspect`}
                                      subtitle={[gecko.morphs_traits, gecko.sex].filter(Boolean).join(' · ')}
                                    />
                                  </div>
                                )}
                                {gecko.hatch_date && (
                                    <p className="text-slate-400 text-xs mt-2">
                                        <Calendar className="w-3 h-3 inline mr-1" />
                                        Hatched: {format(new Date(gecko.hatch_date), 'MMMM d, yyyy')}
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Additional images */}
                        {gecko.image_urls?.length > 1 && (
                            <Card className="bg-slate-900 border-slate-700">
                                <CardContent className="p-3">
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {gecko.image_urls.map((url, i) => (
                                            <img
                                                key={i}
                                                src={url}
                                                alt={`${gecko.name} ${i + 1}`}
                                                className="w-full aspect-square object-cover rounded cursor-pointer hover:opacity-80 transition-opacity ring-0 hover:ring-2 hover:ring-emerald-500"
                                                onClick={() => setLightboxIndex(i)}
                                            />
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Lightbox */}
                        {lightboxIndex !== null && gecko.image_urls?.length > 0 && (
                            <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightboxIndex(null)}>
                                <button className="absolute top-4 right-4 text-white hover:text-slate-300 z-10" onClick={() => setLightboxIndex(null)}>
                                    <X className="w-8 h-8" />
                                </button>
                                <button
                                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full z-10 disabled:opacity-30"
                                    disabled={lightboxIndex === 0}
                                    onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => Math.max(0, prev - 1)); }}
                                >
                                    <ChevronLeft className="w-6 h-6" />
                                </button>
                                <img
                                    src={gecko.image_urls[lightboxIndex]}
                                    alt={`${gecko.name} ${lightboxIndex + 1}`}
                                    className="max-h-[85vh] max-w-full object-contain rounded-lg"
                                    onClick={e => e.stopPropagation()}
                                />
                                <button
                                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full z-10 disabled:opacity-30"
                                    disabled={lightboxIndex === gecko.image_urls.length - 1}
                                    onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => Math.min(gecko.image_urls.length - 1, i + 1)); }}
                                >
                                    <ChevronRight className="w-6 h-6" />
                                </button>
                                <div className="absolute bottom-4 text-slate-400 text-sm">{lightboxIndex + 1} / {gecko.image_urls.length}</div>
                            </div>
                        )}

                        {/* Owner card */}
                        {owner && (
                            <Card className="bg-slate-900 border-slate-700">
                                <CardContent className="p-4">
                                    <h3 className="text-slate-300 font-semibold text-sm mb-3 flex items-center gap-2">
                                        <UserIcon className="w-4 h-4" /> Breeder
                                    </h3>
                                    <Link to={createPageUrl(`PublicProfile?userId=${owner.id}`)} className="flex items-center gap-3 hover:opacity-80 transition-opacity mb-3">
                                        <img
                                            src={owner.profile_image_url || initialsAvatarUrl(owner.full_name || 'B')}
                                            alt={owner.full_name}
                                            className="w-10 h-10 rounded-full object-cover"
                                        />
                                        <div>
                                            <p className="text-slate-100 font-medium">{owner.full_name}</p>
                                            {owner.location && (
                                                <p className="text-slate-400 text-xs flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" />{owner.location}
                                                </p>
                                            )}
                                        </div>
                                    </Link>
                                    {currentUser && !isOwner && (
                                        <MessageUserButton
                                            recipientEmail={owner.email}
                                            recipientName={owner.full_name}
                                            variant="outline"
                                            size="sm"
                                            className="w-full border-emerald-700 text-emerald-400 hover:bg-emerald-900/30"
                                        />
                                    )}
                                    {!currentUser && (
                                        <p className="text-xs text-slate-500 text-center mt-1">
                                            <a href="#" onClick={() => base44.auth.redirectToLogin()} className="text-emerald-400 hover:underline">Log in</a> to contact this breeder
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Right: Details */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Morphs & Traits */}
                        {(gecko.morphs_traits || gecko.morph_tags?.length > 0) && (
                            <Card className="bg-slate-900 border-slate-700">
                                <CardHeader className="pb-2 pt-4 px-4">
                                    <CardTitle className="text-sm flex items-center gap-2 text-slate-300">
                                        <Tag className="w-4 h-4" /> Morphs & Traits
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="px-4 pb-4 space-y-2">
                                    {gecko.morphs_traits && (
                                        <p className="text-slate-200">{gecko.morphs_traits}</p>
                                    )}
                                    {gecko.morph_tags?.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {gecko.morph_tags.map(tag => (
                                                <Badge key={tag} variant="outline" className="border-emerald-700 text-emerald-300 text-xs">{tag}</Badge>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Notes */}
                        {gecko.notes && (
                            <Card className="bg-slate-900 border-slate-700">
                                <CardHeader className="pb-2 pt-4 px-4">
                                    <CardTitle className="text-sm flex items-center gap-2 text-slate-300">
                                        <StickyNote className="w-4 h-4" /> Notes
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="px-4 pb-4">
                                    <p className="text-slate-300 whitespace-pre-wrap">{gecko.notes}</p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Weight Chart */}
                        {chartData.length > 0 && (
                            <Card className="bg-slate-900 border-slate-700">
                                <CardHeader className="pb-2 pt-4 px-4">
                                    <CardTitle className="text-sm flex items-center gap-2 text-slate-300">
                                        <LineChartIcon className="w-4 h-4" /> Weight History
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="px-4 pb-4">
                                    <ResponsiveContainer width="100%" height={180}>
                                        <LineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(134,239,172,0.15)" />
                                            <XAxis dataKey="date" stroke="#a7f3d0" tick={{ fontSize: 11 }} />
                                            <YAxis stroke="#a7f3d0" unit="g" tick={{ fontSize: 11 }} domain={['dataMin - 2', 'dataMax + 2']} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#022c22', border: '1px solid rgba(134,239,172,0.2)' }}
                                                labelStyle={{ color: '#d1fae5' }}
                                                itemStyle={{ color: '#86efac' }}
                                                formatter={v => [`${v}g`, 'Weight']}
                                            />
                                            <Line type="monotone" dataKey="weight" stroke="#86efac" strokeWidth={2} dot={{ r: 3 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}

                        {/* Parentage */}
                        <Card className="bg-slate-900 border-slate-700">
                            <CardHeader className="pb-2 pt-4 px-4">
                                <CardTitle className="text-sm flex items-center gap-2 text-slate-300">
                                    <GitBranch className="w-4 h-4" /> Lineage
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-4 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-800 p-3 rounded-lg">
                                        <p className="text-slate-400 text-xs mb-1">Sire (Father)</p>
                                        <p className="text-slate-200 font-medium">
                                            <ParentName linkedGecko={sire} fallbackName={gecko.sire_name} />
                                        </p>
                                    </div>
                                    <div className="bg-slate-800 p-3 rounded-lg">
                                        <p className="text-slate-400 text-xs mb-1">Dam (Mother)</p>
                                        <p className="text-slate-200 font-medium">
                                            <ParentName linkedGecko={dam} fallbackName={gecko.dam_name} />
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <Link to={`/Pedigree?geckoId=${gecko.id}`}>
                                        <Button size="sm" className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
                                            <GitBranch className="w-4 h-4 mr-2" /> View Pedigree
                                        </Button>
                                    </Link>
                                    <Link to={`${createPageUrl('Lineage')}?geckoId=${gecko.id}`}>
                                        <Button variant="outline" size="sm" className="w-full border-slate-600 hover:bg-slate-800">
                                            Classic Lineage
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Price */}
                        {gecko.asking_price && (
                            <Card className="bg-slate-900 border-slate-700">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-slate-300">
                                        <DollarSign className="w-5 h-5 text-yellow-400" />
                                        <span className="font-semibold">Asking Price</span>
                                    </div>
                                    <span className="text-2xl font-bold text-yellow-400">${gecko.asking_price}</span>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>

                {/* Personalized supplies recommendation. Quietly hides itself
                    when the store is disabled or has no matching products,
                    so this never adds empty-card noise to the page. */}
                <div className="mt-8">
                    <RecommendedKitForGecko gecko={gecko} />
                </div>
            </div>
        </div>
    );
}