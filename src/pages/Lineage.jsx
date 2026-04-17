import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Seo from '@/components/seo/Seo';
import { useLocation } from 'react-router-dom';
import { Gecko, BreedingPlan, LineagePlaceholder } from '@/entities/all';
import { base44 as base44Client } from '@/api/base44Client';
import { Loader2, Search, ZoomIn, ZoomOut, GitBranch, Heart, Users2, Edit2, Upload, Download, AlertTriangle, ExternalLink, Dna, Calendar, Scale, Tag, X, Link as LinkIcon, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageSettingsPanel from '@/components/ui/PageSettingsPanel';
import usePageSettings from '@/hooks/usePageSettings';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { differenceInMonths, format, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';

const DEFAULT_GECKO_IMAGE = 'https://i.imgur.com/sw9gnDp.png';

// Status → color palette for status dot + badge
const STATUS_COLORS = {
    'Proven': { dot: 'bg-emerald-400', text: 'text-emerald-300', ring: 'ring-emerald-400/50', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    'Ready to Breed': { dot: 'bg-blue-400', text: 'text-blue-300', ring: 'ring-blue-400/50', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
    'Future Breeder': { dot: 'bg-violet-400', text: 'text-violet-300', ring: 'ring-violet-400/50', badge: 'bg-violet-500/20 text-violet-300 border-violet-500/40' },
    'Holdback': { dot: 'bg-amber-400', text: 'text-amber-300', ring: 'ring-amber-400/50', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
    'For Sale': { dot: 'bg-cyan-400', text: 'text-cyan-300', ring: 'ring-cyan-400/50', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
    'Pet': { dot: 'bg-pink-400', text: 'text-pink-300', ring: 'ring-pink-400/50', badge: 'bg-pink-500/20 text-pink-300 border-pink-500/40' },
    'Sold': { dot: 'bg-slate-500', text: 'text-slate-400', ring: 'ring-slate-500/50', badge: 'bg-slate-500/20 text-slate-400 border-slate-500/40' },
};

const SEX_BORDER = {
    Male: 'border-l-blue-400',
    Female: 'border-l-pink-400',
};

const formatAge = (hatchDate) => {
    if (!hatchDate) return null;
    try {
        const months = differenceInMonths(new Date(), parseISO(hatchDate));
        if (months < 0) return null;
        if (months < 12) return `${months}mo`;
        const years = Math.floor(months / 12);
        const rem = months % 12;
        return rem === 0 ? `${years}y` : `${years}y ${rem}mo`;
    } catch {
        return null;
    }
};

const formatHatchDate = (hatchDate) => {
    if (!hatchDate) return null;
    try {
        return format(parseISO(hatchDate), 'MMM d, yyyy');
    } catch {
        return null;
    }
};

// Lineage tree helpers (walk the getLineageFor tree)
const countAncestors = (node) => {
    if (!node || node.isPlaceholder) return 0;
    return 1 + countAncestors(node.sire) + countAncestors(node.dam);
};

const maxKnownDepth = (node, depth = 0) => {
    if (!node || node.isPlaceholder) return depth;
    return Math.max(
        depth + 1,
        maxKnownDepth(node.sire, depth + 1),
        maxKnownDepth(node.dam, depth + 1),
    );
};

const collectAncestorIds = (node, set) => {
    if (!node || node.isPlaceholder || !node.id) return;
    set.add(node.id);
    collectAncestorIds(node.sire, set);
    collectAncestorIds(node.dam, set);
};

const findInbreedingOverlap = (lineage) => {
    if (!lineage?.sire || !lineage?.dam) return [];
    const sireSet = new Set();
    const damSet = new Set();
    collectAncestorIds(lineage.sire, sireSet);
    collectAncestorIds(lineage.dam, damSet);
    return [...sireSet].filter((id) => damSet.has(id));
};

// Collect every path from `node` to each known ancestor id, measured in generations away.
// Returns { ancestorId: [distance1, distance2, ...] } — a single ancestor can appear on
// multiple paths if they recur in the tree.
const collectAncestorDistances = (node, distance = 0, map = {}) => {
    if (!node || node.isPlaceholder || !node.id) return map;
    if (distance > 0) {
        if (!map[node.id]) map[node.id] = [];
        map[node.id].push(distance);
    }
    collectAncestorDistances(node.sire, distance + 1, map);
    collectAncestorDistances(node.dam, distance + 1, map);
    return map;
};

// Wright's coefficient of inbreeding.
// F = Σ over common ancestors A of (0.5)^(n1 + n2 + 1) where n1, n2 are the
// number of generations between the sire/dam and the common ancestor. We ignore
// A's own inbreeding coefficient since we don't have it.
const calculateCOI = (lineage) => {
    if (!lineage?.sire || !lineage?.dam) return 0;
    const sireDistances = collectAncestorDistances(lineage.sire);
    const damDistances = collectAncestorDistances(lineage.dam);
    let f = 0;
    for (const id of Object.keys(sireDistances)) {
        if (!damDistances[id]) continue;
        for (const n1 of sireDistances[id]) {
            for (const n2 of damDistances[id]) {
                f += Math.pow(0.5, n1 + n2 + 1);
            }
        }
    }
    return f;
};

// Small stat pill used in the summary bar
const STAT_TONES = {
    default: { border: 'border-slate-700/70', value: 'text-emerald-300' },
    warning: { border: 'border-amber-500/60', value: 'text-amber-300' },
    danger: { border: 'border-red-500/60', value: 'text-red-300' },
};
const StatPill = ({ label, value, tone = 'default', tooltip }) => {
    const t = STAT_TONES[tone] || STAT_TONES.default;
    const inner = (
        <div className={`flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/60 border ${t.border}`}>
            <span className="text-[11px] uppercase tracking-wide text-slate-400">{label}</span>
            <span className={`text-sm font-bold ${t.value}`}>{value}</span>
        </div>
    );
    if (!tooltip) return inner;
    return (
        <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>{inner}</TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs bg-slate-900/95 border border-slate-700 text-slate-100 text-xs p-2">
                {tooltip}
            </TooltipContent>
        </Tooltip>
    );
};

// Placeholder card for missing parents
const PlaceholderCardNode = ({ parentName, placeholderData, onEdit, size = 'normal' }) => {
    const cardSize = size === 'tiny' ? 'w-24 h-28' : size === 'small' ? 'w-28 h-32' : 'w-36 h-44';
    const nameSize = size === 'tiny' ? 'text-[10px]' : size === 'small' ? 'text-xs' : 'text-sm';
    const hasData = placeholderData && (placeholderData.image_url || placeholderData.breeder_name);
    const isEditable = !!onEdit;

    const card = (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex-shrink-0"
        >
            <Card
                className={`relative transition-all duration-300 overflow-hidden ${cardSize} bg-slate-800/50 border-2 border-dashed border-slate-600 ${isEditable ? 'hover:border-emerald-500 cursor-pointer' : 'cursor-default opacity-60'}`}
                onClick={isEditable ? onEdit : undefined}
            >
                <div className="w-full h-full bg-slate-700 flex items-center justify-center relative">
                    <img
                        src={placeholderData?.image_url || DEFAULT_GECKO_IMAGE}
                        alt={parentName || 'Unknown'}
                        className="w-full h-full object-cover opacity-60"
                        loading="lazy"
                        decoding="async"
                    />
                    {isEditable && (
                        <div className="absolute top-1 right-1">
                            <div className="bg-black/60 rounded-full p-1">
                                <Edit2 className="w-3 h-3 text-white" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                    <h4 className={`font-bold ${nameSize} text-slate-300 leading-tight truncate`}>
                        {parentName || 'Unknown'}
                    </h4>
                    {hasData && placeholderData.breeder_name && (
                        <p className="text-[9px] text-slate-400 truncate">
                            From: {placeholderData.breeder_name}
                        </p>
                    )}
                </div>
            </Card>
        </motion.div>
    );

    if (!isEditable && !hasData) return card;

    return (
        <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>{card}</TooltipTrigger>
            <TooltipContent
                side="top"
                className="max-w-xs bg-slate-900/95 border border-slate-700 text-slate-100 text-xs p-3 space-y-1.5 shadow-2xl"
            >
                <div className="font-bold text-sm text-slate-200">{parentName || 'Unknown'}</div>
                {placeholderData?.breeder_name && (
                    <div className="text-slate-300">From: {placeholderData.breeder_name}</div>
                )}
                {placeholderData?.breeder_website && (
                    <div className="text-emerald-300 truncate">{placeholderData.breeder_website}</div>
                )}
                {placeholderData?.notes && (
                    <div className="text-slate-400 italic">{placeholderData.notes}</div>
                )}
                {isEditable && (
                    <div className="text-emerald-400 text-[10px] pt-1 border-t border-slate-700">
                        Click to edit parent info
                    </div>
                )}
            </TooltipContent>
        </Tooltip>
    );
};

// GeckoCardNode component
const GeckoCardNode = ({
    gecko,
    onNodeClick,
    isSelected,
    size = 'normal',
    isFaded = false,
    className = '',
    isOnHighlightPath = false,
    isDimmed = false,
    onHoverEnter,
    onHoverLeave,
}) => {
    if (!gecko) {
        return <UnknownCardNode size={size} />;
    }
    const hasImage = gecko.image_urls && gecko.image_urls.length > 0;

    const sizes = {
        tiny: { card: 'w-24 h-28', name: 'text-[10px]', id: 'text-[9px]' },
        small: { card: 'w-28 h-32', name: 'text-xs', id: 'text-[10px]' },
        normal: { card: 'w-36 h-44', name: 'text-sm', id: 'text-xs' },
    };
    const { card: cardSize, name: nameTextSize, id: idTextSize } = sizes[size] || sizes.normal;

    const sexIcon = gecko.sex === 'Male' ? '♂' : gecko.sex === 'Female' ? '♀' : '?';
    const sexColor = gecko.sex === 'Male' ? 'text-blue-400' : gecko.sex === 'Female' ? 'text-pink-400' : 'text-gray-400';
    const sexBorder = SEX_BORDER[gecko.sex] || 'border-l-slate-500';
    const statusColor = STATUS_COLORS[gecko.status];
    const age = formatAge(gecko.hatch_date);
    const morphTags = Array.isArray(gecko.morph_tags) ? gecko.morph_tags.filter(Boolean) : [];
    const showDetails = size === 'normal';
    const showAgeBadge = size !== 'tiny' && age;

    const highlightRing = isOnHighlightPath && !isSelected
        ? 'ring-2 ring-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.5)] z-10'
        : '';
    const dimClass = isDimmed ? 'opacity-40' : '';

    const card = (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex-shrink-0"
            onMouseEnter={onHoverEnter}
            onMouseLeave={onHoverLeave}
        >
            <Card
                className={`relative transition-all duration-300 overflow-hidden border-l-4 ${sexBorder} ${cardSize} ${className} ${isSelected ? 'ring-2 ring-emerald-400 shadow-2xl shadow-emerald-500/30 z-10' : highlightRing || 'shadow-lg'} ${dimClass} bg-slate-800/80 backdrop-blur-sm border-slate-700 hover:shadow-xl hover:ring-2 hover:ring-emerald-500/50 cursor-pointer ${isFaded ? 'opacity-50' : ''}`}
                onClick={(e) => { e.stopPropagation(); onNodeClick(gecko.id); }}
            >
                <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                    <img
                        src={hasImage ? gecko.image_urls[0] : DEFAULT_GECKO_IMAGE}
                        alt={gecko.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                    />
                </div>

                {/* Status dot (top-right) */}
                {statusColor && (
                    <div className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ${statusColor.dot} ring-2 ${statusColor.ring} shadow-md`} />
                )}

                {/* Age badge (top-left) */}
                {showAgeBadge && (
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[9px] font-semibold text-white/90 leading-none">
                        {age}
                    </div>
                )}

                {/* Morph tag pills (bottom row, above name) */}
                {showDetails && morphTags.length > 0 && (
                    <div className="absolute bottom-9 left-1 right-1 flex gap-1 pointer-events-none">
                        {morphTags.slice(0, 2).map((tag) => (
                            <span
                                key={tag}
                                className="px-1.5 py-0.5 rounded bg-emerald-500/30 backdrop-blur-sm text-[9px] font-semibold text-emerald-100 truncate max-w-[60px] border border-emerald-400/30"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
                    <div className="flex items-center gap-0.5">
                        <h4 className={`font-bold ${nameTextSize} text-white leading-tight truncate drop-shadow-md`}>
                            {gecko.name}
                        </h4>
                        <span className={`font-bold ${nameTextSize} ${sexColor} drop-shadow-md`}>
                            {sexIcon}
                        </span>
                    </div>
                    <p className={`${idTextSize} text-white/90 truncate drop-shadow-md`}>
                        {gecko.gecko_id_code || 'No ID'}
                    </p>
                </div>
            </Card>
        </motion.div>
    );

    // Rich tooltip wrapper
    const hatchDateFormatted = formatHatchDate(gecko.hatch_date);
    const hasTooltipContent =
        gecko.status || morphTags.length > 0 || hatchDateFormatted || gecko.weight_grams ||
        gecko.morphs_traits || gecko.gecko_id_code;

    if (!hasTooltipContent) return card;

    return (
        <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>{card}</TooltipTrigger>
            <TooltipContent
                side="top"
                className="max-w-xs bg-slate-900/95 border border-slate-700 text-slate-100 text-xs p-3 space-y-1.5 shadow-2xl"
            >
                <div className="font-bold text-sm text-white flex items-center gap-1.5">
                    {gecko.name}
                    <span className={sexColor}>{sexIcon}</span>
                </div>
                {gecko.gecko_id_code && (
                    <div className="text-slate-400 font-mono text-[10px]">{gecko.gecko_id_code}</div>
                )}
                {gecko.status && statusColor && (
                    <div className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold ${statusColor.badge}`}>
                        {gecko.status}
                    </div>
                )}
                {morphTags.length > 0 && (
                    <div className="flex items-start gap-1.5">
                        <Tag className="w-3 h-3 mt-0.5 text-emerald-400 flex-shrink-0" />
                        <div className="flex flex-wrap gap-1">
                            {morphTags.map((tag) => (
                                <span key={tag} className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
                {gecko.morphs_traits && (
                    <div className="flex items-start gap-1.5 text-slate-300">
                        <Dna className="w-3 h-3 mt-0.5 text-violet-400 flex-shrink-0" />
                        <span className="italic">{gecko.morphs_traits}</span>
                    </div>
                )}
                {hatchDateFormatted && (
                    <div className="flex items-center gap-1.5 text-slate-300">
                        <Calendar className="w-3 h-3 text-amber-400" />
                        <span>{hatchDateFormatted}{age ? ` · ${age} old` : ''}</span>
                    </div>
                )}
                {gecko.weight_grams != null && gecko.weight_grams !== '' && (
                    <div className="flex items-center gap-1.5 text-slate-300">
                        <Scale className="w-3 h-3 text-cyan-400" />
                        <span>{gecko.weight_grams}g</span>
                    </div>
                )}
            </TooltipContent>
        </Tooltip>
    );
};

// Simplified UnknownCard
const UnknownCardNode = ({ size = 'normal' }) => {
     const cardSize = size === 'tiny' ? 'w-24 h-28' : size === 'small' ? 'w-28 h-32' : 'w-36 h-44';
     return (
         <div className={`flex-shrink-0 relative overflow-hidden bg-slate-800/50 border-2 border-dashed border-slate-600 rounded-lg ${cardSize}`}>
             <img 
                 src={DEFAULT_GECKO_IMAGE} 
                 alt="Unknown" 
                 className="w-full h-full object-cover opacity-50"
                 loading="lazy"
                 decoding="async"
             />
            <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                <span className="text-xs text-slate-400">Unknown</span>
            </div>
        </div>
    );
};


export default function Lineage() {
    const [lineagePrefs, setLineagePrefs] = usePageSettings('lineage_prefs', {
        defaultGenerations: '3',
        defaultZoom: '100',
        showUnknownParents: true,
    });
    const location = useLocation();
    const [myGeckos, setMyGeckos] = useState([]);
    const [allGeckosMap, setAllGeckosMap] = useState({});
    const [allBreedingPlans, setAllBreedingPlans] = useState([]);
    const [placeholders, setPlaceholders] = useState({});
    
    const [selectedGeckoId, setSelectedGeckoId] = useState(null);
    const [lineage, setLineage] = useState({});
    const [mates, setMates] = useState([]);
    const [offspring, setOffspring] = useState([]);
    const [recentGeckoIds, setRecentGeckoIds] = useState(() => {
        try {
            const raw = localStorage.getItem('lineage_recent_geckos');
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
        } catch {
            return [];
        }
    });
    const pushRecentGecko = useCallback((geckoId) => {
        if (!geckoId) return;
        setRecentGeckoIds((prev) => {
            const next = [geckoId, ...prev.filter((id) => id !== geckoId)].slice(0, 8);
            try {
                localStorage.setItem('lineage_recent_geckos', JSON.stringify(next));
            } catch {
                // ignore quota / privacy-mode failures
            }
            return next;
        });
    }, []);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingLineage, setIsLoadingLineage] = useState(false);
    // Hover path from root selected gecko down to the hovered ancestor, used
    // to highlight the chain of cards connecting them.
    const [highlightPath, setHighlightPath] = useState(null);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchRef = useRef(null);
    const [scale, setScale] = useState(Number(lineagePrefs.defaultZoom) / 100);
    const [generations, setGenerations] = useState(Number(lineagePrefs.defaultGenerations));
    const mainContentRef = useRef(null);
    const treeAreaRef = useRef(null);
    
    // Touch/pinch zoom state
    const [initialDistance, setInitialDistance] = useState(null);
    const [initialScale, setInitialScale] = useState(1);
    
    // Placeholder editing
    const [editingPlaceholder, setEditingPlaceholder] = useState(null);
    const [placeholderForm, setPlaceholderForm] = useState({
        name: '',
        image_url: '',
        breeder_name: '',
        breeder_website: '',
        notes: ''
    });
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    // Pinch-to-zoom handlers
    const handleTouchStart = (e) => {
        if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            setInitialDistance(dist);
            setInitialScale(scale);
        }
    };

    const handleTouchMove = (e) => {
        if (e.touches.length === 2 && initialDistance) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const newScale = Math.min(2, Math.max(0.3, initialScale * (dist / initialDistance)));
            setScale(newScale);
        }
    };

    const handleTouchEnd = () => {
        setInitialDistance(null);
    };

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        try {
            const currentUser = await base44Client.auth.me().catch(() => null);
            const [userGeckos, allVisibleGeckos, userPlaceholders] = await Promise.all([
                currentUser ? Gecko.filter({ created_by: currentUser.email }) : [],
                Gecko.list(),
                currentUser ? LineagePlaceholder.filter({ created_by: currentUser.email }).catch(() => []) : []
            ]);
            
            let breedingPlans = [];
            try {
                breedingPlans = await BreedingPlan.filter({ created_by: currentUser.email });
            } catch (error) {
                console.warn("Could not load breeding plans:", error);
            }
            
            setMyGeckos(userGeckos.filter(g => !g.notes?.startsWith('[Manual sale]')));
            setAllGeckosMap(Object.fromEntries(allVisibleGeckos.filter(g => !g.notes?.startsWith('[Manual sale]')).map(g => [g.id, g])));
            setAllBreedingPlans(breedingPlans);
            
            const placeholderMap = {};
            userPlaceholders.forEach(p => {
                const key = `${p.gecko_id}_${p.parent_type}`;
                placeholderMap[key] = p;
            });
            setPlaceholders(placeholderMap);
        } catch (error) {
            console.error("Failed to load initial data:", error);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // Build lineage tree recursively - always create both sire and dam for each generation
    const getLineageFor = useCallback(async (geckoId, maxGen, currentGen = 1) => {
        if (currentGen > maxGen || !geckoId) {
            return null;
        }
        const gecko = allGeckosMap[geckoId];
        if (!gecko) return null;

        let sire = null;
        let dam = null;
        
        // Always create both parents if we're not at the last generation
        if (currentGen < maxGen) {
            // Handle sire
            if (gecko.sire_id && allGeckosMap[gecko.sire_id]) {
                sire = await getLineageFor(gecko.sire_id, maxGen, currentGen + 1);
            }
            // If no real sire found, create placeholder
            if (!sire) {
                sire = { 
                    name: gecko.sire_name || 'Unknown Sire', 
                    isPlaceholder: true, 
                    geckoId: gecko.id,
                    parentType: 'sire'
                };
            }
            
            // Handle dam
            if (gecko.dam_id && allGeckosMap[gecko.dam_id]) {
                dam = await getLineageFor(gecko.dam_id, maxGen, currentGen + 1);
            }
            // If no real dam found, create placeholder
            if (!dam) {
                dam = { 
                    name: gecko.dam_name || 'Unknown Dam', 
                    isPlaceholder: true, 
                    geckoId: gecko.id,
                    parentType: 'dam'
                };
            }
        }
        
        return { ...gecko, sire, dam };
    }, [allGeckosMap]);

    const handleSelectGecko = useCallback(async (geckoId) => {
        if (!geckoId || !allGeckosMap[geckoId]) {
            setLineage({});
            setMates([]);
            setOffspring([]);
            setSelectedGeckoId(null);
            return;
        }
        setIsLoadingLineage(true);
        setSelectedGeckoId(geckoId);
        pushRecentGecko(geckoId);

        const lineageData = await getLineageFor(geckoId, generations);
        setLineage(lineageData || {});

        // Get offspring - fetch by both sire and dam separately then combine
        const [sireOffspring, damOffspring] = await Promise.all([
            Gecko.filter({ sire_id: geckoId }),
            Gecko.filter({ dam_id: geckoId })
        ]);
        const allOffspring = [...sireOffspring, ...damOffspring];
        // Remove duplicates by ID
        const uniqueOffspring = Array.from(new Map(allOffspring.map(g => [g.id, g])).values());
        setOffspring(uniqueOffspring);

        const mateIds = new Set();
        allBreedingPlans.forEach(plan => {
            if (plan.sire_id === geckoId) mateIds.add(plan.dam_id);
            if (plan.dam_id === geckoId) mateIds.add(plan.sire_id);
        });
        const foundMates = Array.from(mateIds).map(id => allGeckosMap[id]).filter(Boolean);
        setMates(foundMates);
        
        setIsLoadingLineage(false);
    }, [getLineageFor, allGeckosMap, allBreedingPlans, generations, pushRecentGecko]);

    // Re-fetch lineage when generations change
    useEffect(() => {
        if (selectedGeckoId) {
            handleSelectGecko(selectedGeckoId);
        }
    }, [generations]);

    // Keyboard navigation: arrow keys jump between sire / dam / first offspring.
    useEffect(() => {
        if (!selectedGeckoId) return undefined;
        const handler = (e) => {
            const target = e.target;
            const isEditable =
                target &&
                (target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable);
            if (isEditable) return;
            const current = allGeckosMap[selectedGeckoId];
            if (!current) return;
            let nextId = null;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                nextId = current.sire_id || current.dam_id;
            } else if (e.key === 'ArrowRight') {
                nextId = current.dam_id || current.sire_id;
            } else if (e.key === 'ArrowDown') {
                nextId = offspring[0]?.id;
            }
            if (nextId && allGeckosMap[nextId]) {
                e.preventDefault();
                handleSelectGecko(nextId);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selectedGeckoId, allGeckosMap, offspring, handleSelectGecko]);

    // Stats derived from the currently rendered lineage tree
    const stats = useMemo(() => {
        if (!lineage?.id) return null;
        const ancestorCount = countAncestors(lineage) - 1; // exclude selected gecko
        const depth = maxKnownDepth(lineage);
        const overlap = findInbreedingOverlap(lineage);
        const inbreedingAncestors = overlap
            .map((id) => allGeckosMap[id])
            .filter(Boolean);
        const coi = calculateCOI(lineage);
        return {
            ancestorCount: Math.max(0, ancestorCount),
            depth,
            offspringCount: offspring.length,
            matesCount: mates.length,
            inbreedingAncestors,
            coi,
        };
    }, [lineage, offspring, mates, allGeckosMap]);

    const selectedGecko = selectedGeckoId ? allGeckosMap[selectedGeckoId] : null;

    // Resolve recent gecko IDs against the loaded gecko map, dropping any that
    // aren't visible to the current user anymore.
    const recentGeckos = useMemo(
        () => recentGeckoIds.map((id) => allGeckosMap[id]).filter(Boolean),
        [recentGeckoIds, allGeckosMap],
    );

    // Side panel layout scales with the tree's generation count so mates/offspring
    // can expand laterally as the tree gets wider.
    const sidePanelWidth =
        generations >= 5 ? 'md:w-80' :
        generations >= 4 ? 'md:w-60' :
        'md:w-36';
    const sidePanelGridCols =
        generations >= 5 ? 'md:grid-cols-3' :
        generations >= 4 ? 'md:grid-cols-2' :
        'md:grid-cols-1';
    const sidePanelCardSize = generations >= 4 ? 'tiny' : 'small';

    // Track desktop vs mobile so the offspring column cap can match the user's
    // "6 desktop / 10 mobile" request responsively.
    const [isDesktop, setIsDesktop] = useState(
        typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
    );
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const mq = window.matchMedia('(min-width: 768px)');
        const handler = (e) => setIsDesktop(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    // Offspring column uses the same card size as mates and gets clamped to
    // mates.length rows (capped at 6 desktop / 10 mobile) so its panel height
    // matches the mates panel, keeping their top edges aligned.
    const offspringCap = isDesktop ? 6 : 10;
    const offspringRows = Math.max(1, Math.min(mates.length || offspringCap, offspringCap));

    // Copy shareable link (reuses ?geckoId= URL param the page already accepts)
    const [copiedLink, setCopiedLink] = useState(false);
    const handleCopyLink = async () => {
        if (!selectedGeckoId) return;
        const url = `${window.location.origin}/Lineage?geckoId=${selectedGeckoId}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 1600);
        } catch (error) {
            console.error('Failed to copy link:', error);
        }
    };

    // PNG export via html2canvas
    const [isExporting, setIsExporting] = useState(false);
    const handleExportPng = async () => {
        const target = treeAreaRef.current;
        if (!target || !selectedGecko) return;
        setIsExporting(true);
        // Temporarily reset CSS scale so html2canvas captures the real layout.
        const previousTransform = target.style.transform;
        target.style.transform = 'scale(1)';
        try {
            const canvas = await html2canvas(target, {
                backgroundColor: '#020617',
                scale: 2,
                useCORS: true,
                allowTaint: true,
            });
            const url = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = url;
            link.download = `lineage-${selectedGecko.name || 'gecko'}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Failed to export lineage PNG:', error);
        } finally {
            target.style.transform = previousTransform;
            setIsExporting(false);
        }
    };

    useEffect(() => {
        // Accept both `geckoId` and `geckoid` — some older call sites
        // passed the whole thing through createPageUrl() which lowercases
        // the query string and turned `geckoId` into `geckoid`.
        const params = new URLSearchParams(location.search);
        const geckoIdFromUrl = params.get('geckoId') || params.get('geckoid');

        if (geckoIdFromUrl && allGeckosMap[geckoIdFromUrl] && !isLoading) {
            handleSelectGecko(geckoIdFromUrl);
        }
    }, [location.search, allGeckosMap, isLoading, handleSelectGecko]);

    const handleEditPlaceholder = (gecko, parentType) => {
        const key = `${gecko.geckoId}_${parentType}`;
        const existing = placeholders[key];
        
        setEditingPlaceholder({ geckoId: gecko.geckoId, parentType, name: gecko.name });
        setPlaceholderForm({
            name: gecko.name || '',
            image_url: existing?.image_url || '',
            breeder_name: existing?.breeder_name || '',
            breeder_website: existing?.breeder_website || '',
            notes: existing?.notes || ''
        });
    };

    const handlePlaceholderImageUpload = async (file) => {
        if (!file) return;
        setIsUploadingImage(true);
        try {
            const { file_url } = await base44Client.integrations.Core.UploadFile({ file });
            setPlaceholderForm(f => ({ ...f, image_url: file_url }));
        } catch (error) {
            console.error('Failed to upload image:', error);
        }
        setIsUploadingImage(false);
    };

    const handleSavePlaceholder = async () => {
        if (!editingPlaceholder) return;
        
        try {
            const key = `${editingPlaceholder.geckoId}_${editingPlaceholder.parentType}`;
            const existing = placeholders[key];
            
            const data = {
                gecko_id: editingPlaceholder.geckoId,
                parent_type: editingPlaceholder.parentType,
                name: placeholderForm.name || editingPlaceholder.name,
                image_url: placeholderForm.image_url,
                breeder_name: placeholderForm.breeder_name,
                breeder_website: placeholderForm.breeder_website,
                notes: placeholderForm.notes
            };
            
            if (existing) {
                await LineagePlaceholder.update(existing.id, data);
            } else {
                await LineagePlaceholder.create(data);
            }
            
            await fetchAllData();
            setEditingPlaceholder(null);
        } catch (error) {
            console.error("Failed to save placeholder:", error);
        }
    };

    // Get card size based on generation depth
    const getCardSize = (generation) => {
        if (generations >= 4) {
            return generation === 1 ? 'small' : 'tiny';
        }
        return generation === 1 ? 'normal' : generation === 2 ? 'small' : 'tiny';
    };

    // Render a single node (gecko or placeholder)
    const renderNode = (gecko, generation, path = []) => {
        if (!gecko) return null;

        const cardSize = getCardSize(generation);

        if (gecko.isPlaceholder) {
            if (!lineagePrefs.showUnknownParents) return null;
            const key = `${gecko.geckoId}_${gecko.parentType}`;
            const placeholderData = placeholders[key];
            return (
                <PlaceholderCardNode
                    parentName={gecko.name}
                    placeholderData={placeholderData}
                    onEdit={() => handleEditPlaceholder(gecko, gecko.parentType)}
                    size={cardSize}
                />
            );
        }

        // A card is on the highlight path when its own path is a prefix of the
        // currently hovered card's path (including being equal to it).
        const isOnHighlightPath = !!highlightPath &&
            path.length <= highlightPath.length &&
            path.every((step, i) => step === highlightPath[i]);

        return (
            <GeckoCardNode
                gecko={gecko}
                onNodeClick={handleSelectGecko}
                isSelected={selectedGeckoId === gecko.id}
                size={cardSize}
                isOnHighlightPath={isOnHighlightPath}
                isDimmed={!!highlightPath && !isOnHighlightPath}
                onHoverEnter={() => setHighlightPath(path)}
                onHoverLeave={() => setHighlightPath(null)}
            />
        );
    };

    // Render placeholder with its own unknown parents
    // uniqueKey tracks the full ancestry path so each node has its own identity
    const renderPlaceholderWithParents = (placeholder, generation, maxGen, uniqueKey) => {
        if (!lineagePrefs.showUnknownParents) return null;
        const cardSize = getCardSize(generation);
        // Only look up real placeholder data using the actual base geckoId
        const key = `${placeholder.geckoId}_${placeholder.parentType}`;
        const placeholderData = placeholder.isAncestorPadding ? null : placeholders[key];
        
        // If we need to show more generations, add unknown parents above
        if (generation < maxGen) {
            const sireUniqueKey = `${uniqueKey}_sire`;
            const damUniqueKey = `${uniqueKey}_dam`;
            return (
                <div className="flex flex-col items-center">
                    {/* Unknown grandparents — marked as ancestor padding so they don't share data */}
                    <div className="flex gap-2 md:gap-4">
                        <div className="flex flex-col items-center">
                            {renderPlaceholderWithParents(
                                { name: 'Unknown', isPlaceholder: true, geckoId: sireUniqueKey, parentType: 'sire', isAncestorPadding: true },
                                generation + 1,
                                maxGen,
                                sireUniqueKey
                            )}
                        </div>
                        <div className="flex flex-col items-center">
                            {renderPlaceholderWithParents(
                                { name: 'Unknown', isPlaceholder: true, geckoId: damUniqueKey, parentType: 'dam', isAncestorPadding: true },
                                generation + 1,
                                maxGen,
                                damUniqueKey
                            )}
                        </div>
                    </div>
                    {/* Connecting lines */}
                    <div className="flex items-center justify-center w-full">
                        <div className="h-4 w-[2px] bg-gradient-to-b from-emerald-500/40 to-emerald-700/30"></div>
                    </div>
                    <div className="flex items-center justify-center">
                        <div className="w-1/4 h-[2px] bg-gradient-to-r from-emerald-700/30 to-emerald-500/40"></div>
                        <div className="h-4 w-[2px] bg-gradient-to-b from-emerald-500/40 to-emerald-700/30"></div>
                        <div className="w-1/4 h-[2px] bg-gradient-to-l from-emerald-700/30 to-emerald-500/40"></div>
                    </div>
                    {/* This placeholder */}
                    <PlaceholderCardNode 
                        parentName={placeholder.isAncestorPadding ? 'Unknown' : (placeholderData?.name || placeholder.name)}
                        placeholderData={placeholder.isAncestorPadding ? null : placeholderData}
                        onEdit={placeholder.isAncestorPadding ? undefined : () => handleEditPlaceholder(placeholder, placeholder.parentType)}
                        size={cardSize}
                    />
                </div>
            );
        }
        
        // At max generation, just show the placeholder
        return (
            <PlaceholderCardNode 
                parentName={placeholder.isAncestorPadding ? 'Unknown' : (placeholderData?.name || placeholder.name)}
                placeholderData={placeholder.isAncestorPadding ? null : placeholderData}
                onEdit={placeholder.isAncestorPadding ? undefined : () => handleEditPlaceholder(placeholder, placeholder.parentType)}
                size={cardSize}
            />
        );
    };

    // Render the tree recursively - parents above, child below
    const renderTree = (gecko, generation, path = []) => {
        if (!gecko) return null;

        // Handle placeholders - they need their own parent tree
        if (gecko.isPlaceholder) {
            const uniqueKey = `${gecko.geckoId}_${gecko.parentType}`;
            return renderPlaceholderWithParents(gecko, generation, generations, uniqueKey);
        }

        const showUnknown = lineagePrefs.showUnknownParents;
        const sireVisible = gecko.sire && (showUnknown || !gecko.sire.isPlaceholder);
        const damVisible = gecko.dam && (showUnknown || !gecko.dam.isPlaceholder);
        const hasParents = sireVisible || damVisible;

        // Connector brightness follows the hover path so the chain visibly glows.
        const sireOnPath = !!highlightPath && highlightPath[path.length] === 'sire' && path.every((s, i) => s === highlightPath[i]);
        const damOnPath = !!highlightPath && highlightPath[path.length] === 'dam' && path.every((s, i) => s === highlightPath[i]);
        const trunkOnPath = sireOnPath || damOnPath;

        const trunkClass = trunkOnPath
            ? 'bg-gradient-to-b from-amber-300 to-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.7)]'
            : 'bg-gradient-to-b from-emerald-500/60 to-emerald-700/40 shadow-[0_0_6px_rgba(16,185,129,0.3)]';
        const sireArmClass = sireOnPath
            ? 'bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_6px_rgba(251,191,36,0.6)]'
            : 'bg-gradient-to-r from-emerald-700/40 to-emerald-500/60';
        const damArmClass = damOnPath
            ? 'bg-gradient-to-l from-amber-400 to-amber-500 shadow-[0_0_6px_rgba(251,191,36,0.6)]'
            : 'bg-gradient-to-l from-emerald-700/40 to-emerald-500/60';

        return (
            <div className="flex flex-col items-center">
                {/* Parents Row */}
                {hasParents && (
                    <>
                        <div className="flex gap-2 md:gap-4">
                            {sireVisible && (
                                <div className="flex flex-col items-center">
                                    {renderTree(gecko.sire, generation + 1, [...path, 'sire'])}
                                </div>
                            )}
                            {damVisible && (
                                <div className="flex flex-col items-center">
                                    {renderTree(gecko.dam, generation + 1, [...path, 'dam'])}
                                </div>
                            )}
                        </div>
                        {/* Connecting lines */}
                        <div className="flex items-center justify-center w-full">
                            <div className={`h-4 w-[2px] ${trunkClass}`}></div>
                        </div>
                        <div className="flex items-center justify-center">
                            <div className={`w-1/4 h-[2px] ${sireArmClass}`}></div>
                            <div className={`h-4 w-[2px] ${trunkClass}`}></div>
                            <div className={`w-1/4 h-[2px] ${damArmClass}`}></div>
                        </div>
                    </>
                )}

                {/* Current Node */}
                {renderNode(gecko, generation, path)}
            </div>
        );
    };

    const filteredSelectableGeckos = myGeckos.filter(g => 
        !searchTerm ||
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        g.gecko_id_code?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));

    const handleSearchSelect = (gecko) => {
        setSearchTerm(gecko.name + (gecko.gecko_id_code ? ` (${gecko.gecko_id_code})` : ''));
        setShowSuggestions(false);
        handleSelectGecko(gecko.id);
    };

    return (
        <TooltipProvider>
        <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden">
            <Seo
                title="Lineage Tree"
                description="Visualize your crested gecko family trees with an interactive lineage explorer. Trace ancestry across generations."
                path="/Lineage"
                noIndex
                keywords={['gecko lineage', 'pedigree tree', 'ancestry tracker', 'gecko family tree']}
            />
            <header className="p-3 md:p-4 border-b border-slate-700 flex-shrink-0 z-20 bg-slate-950/80 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:justify-start items-center gap-3">
                    <div className="text-center md:text-left md:mr-6">
                        <h1 className="text-xl md:text-2xl font-bold text-slate-100">Gecko Lineage</h1>
                        <p className="text-slate-400 text-sm hidden md:block">
                            Select a gecko to view its family tree
                            {selectedGeckoId && (
                                <>
                                    {' '}·{' '}
                                    <a
                                        href={`/Pedigree?geckoId=${selectedGeckoId}`}
                                        className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
                                    >
                                        Open pedigree chart →
                                    </a>
                                </>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        {/* Autocomplete gecko search */}
                        <div className="relative flex-grow md:flex-grow-0" ref={searchRef}>
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 z-10" />
                            <Input
                                type="text"
                                placeholder="Search gecko..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setShowSuggestions(true);
                                }}
                                onFocus={() => setShowSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                className="pl-9 w-full md:w-64 h-10"
                            />
                            {showSuggestions && filteredSelectableGeckos.length > 0 && (
                                <div className="absolute top-full left-0 mt-1 bg-slate-900 border border-slate-600 rounded-lg shadow-2xl z-[99999] max-h-72 overflow-y-auto md:w-80 w-full">
                                    {filteredSelectableGeckos.map((gecko, idx) => (
                                        <button
                                            key={gecko.id}
                                            className={`w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-3 transition-colors ${idx !== 0 ? 'border-t border-slate-700/60' : ''}`}
                                            onMouseDown={() => handleSearchSelect(gecko)}
                                        >
                                            <img
                                                src={gecko.image_urls?.[0] || 'https://i.imgur.com/sw9gnDp.png'}
                                                alt={gecko.name}
                                                className="w-9 h-9 rounded object-cover flex-shrink-0"
                                                loading="lazy"
                                                decoding="async"
                                            />
                                            <span className="font-medium">{gecko.name}</span>
                                            {gecko.gecko_id_code && (
                                                <span className="text-slate-400 text-xs ml-auto">{gecko.gecko_id_code}</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Select value={generations.toString()} onValueChange={(v) => setGenerations(parseInt(v))}>
                            <SelectTrigger className="w-28 h-10">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="2">2 Gen</SelectItem>
                                <SelectItem value="3">3 Gen</SelectItem>
                                <SelectItem value="4">4 Gen</SelectItem>
                                <SelectItem value="5">5 Gen</SelectItem>
                            </SelectContent>
                        </Select>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={handleCopyLink}
                                    disabled={!selectedGeckoId}
                                    className="h-10 w-10 bg-slate-800 border-slate-600 hover:bg-slate-700 disabled:opacity-40"
                                    aria-label="Copy shareable link"
                                >
                                    {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <LinkIcon className="w-4 h-4" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{copiedLink ? 'Link copied!' : 'Copy shareable link'}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={handleExportPng}
                                    disabled={!selectedGeckoId || isExporting}
                                    className="h-10 w-10 bg-slate-800 border-slate-600 hover:bg-slate-700 disabled:opacity-40"
                                    aria-label="Download lineage as PNG"
                                >
                                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Download as PNG</TooltipContent>
                        </Tooltip>
                        <PageSettingsPanel title="Lineage Settings">
                            <div>
                                <Label className="text-slate-300 text-sm mb-1 block">Default Generations</Label>
                                <div className="flex gap-1">
                                    {['2', '3', '4', '5'].map(n => (
                                        <button
                                            key={n}
                                            onClick={() => { setLineagePrefs({ defaultGenerations: n }); setGenerations(Number(n)); }}
                                            className={`px-3 py-1 text-xs rounded ${lineagePrefs.defaultGenerations === n ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <Label className="text-slate-300 text-sm mb-1 block">Default Zoom</Label>
                                <div className="flex gap-1">
                                    {['50', '75', '100', '125'].map(z => (
                                        <button
                                            key={z}
                                            onClick={() => { setLineagePrefs({ defaultZoom: z }); setScale(Number(z) / 100); }}
                                            className={`px-2 py-1 text-xs rounded ${lineagePrefs.defaultZoom === z ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                                        >
                                            {z}%
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="text-slate-300 text-sm">Show Unknown Parents</Label>
                                <Switch checked={lineagePrefs.showUnknownParents} onCheckedChange={v => setLineagePrefs({ showUnknownParents: v })} />
                            </div>
                        </PageSettingsPanel>
                    </div>
                </div>
            </header>

            {/* Selected gecko detail strip */}
            <AnimatePresence initial={false}>
                {selectedGecko && (
                    <motion.section
                        key="detail-strip"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="flex-shrink-0 border-b border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden"
                    >
                        <div className="max-w-7xl mx-auto px-3 md:px-6 py-3 flex flex-col md:flex-row gap-4 items-start md:items-center">
                            <img
                                src={selectedGecko.image_urls?.[0] || DEFAULT_GECKO_IMAGE}
                                alt={selectedGecko.name}
                                className="w-16 h-16 md:w-20 md:h-20 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                                loading="lazy"
                                decoding="async"
                            />
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-lg md:text-xl font-bold text-white">
                                        {selectedGecko.name}
                                    </h2>
                                    <span className={`text-lg font-bold ${selectedGecko.sex === 'Male' ? 'text-blue-400' : selectedGecko.sex === 'Female' ? 'text-pink-400' : 'text-gray-400'}`}>
                                        {selectedGecko.sex === 'Male' ? '♂' : selectedGecko.sex === 'Female' ? '♀' : '?'}
                                    </span>
                                    {selectedGecko.gecko_id_code && (
                                        <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
                                            {selectedGecko.gecko_id_code}
                                        </span>
                                    )}
                                    {selectedGecko.status && STATUS_COLORS[selectedGecko.status] && (
                                        <Badge className={`border ${STATUS_COLORS[selectedGecko.status].badge}`}>
                                            {selectedGecko.status}
                                        </Badge>
                                    )}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                                    {formatHatchDate(selectedGecko.hatch_date) && (
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3 text-amber-400" />
                                            {formatHatchDate(selectedGecko.hatch_date)}
                                            {formatAge(selectedGecko.hatch_date) && ` · ${formatAge(selectedGecko.hatch_date)}`}
                                        </span>
                                    )}
                                    {selectedGecko.weight_grams != null && selectedGecko.weight_grams !== '' && (
                                        <span className="flex items-center gap-1">
                                            <Scale className="w-3 h-3 text-cyan-400" />
                                            {selectedGecko.weight_grams}g
                                        </span>
                                    )}
                                </div>
                                {Array.isArray(selectedGecko.morph_tags) && selectedGecko.morph_tags.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {selectedGecko.morph_tags.filter(Boolean).map((tag) => (
                                            <span
                                                key={tag}
                                                className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 text-[10px] font-semibold"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <a
                                    href={`/GeckoDetail?id=${selectedGeckoId}`}
                                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded border border-emerald-600/50 bg-emerald-600/10 text-emerald-300 hover:bg-emerald-600/20 transition-colors"
                                >
                                    Full profile <ExternalLink className="w-3 h-3" />
                                </a>
                                <a
                                    href={`/Pedigree?geckoId=${selectedGeckoId}`}
                                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                                >
                                    Pedigree chart <ExternalLink className="w-3 h-3" />
                                </a>
                                <button
                                    onClick={() => handleSelectGecko(null)}
                                    className="inline-flex items-center justify-center p-1.5 rounded border border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
                                    aria-label="Clear selection"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        </div>

                        {/* Recently viewed breadcrumb */}
                        {recentGeckos.length > 1 && (
                            <div className="max-w-7xl mx-auto px-3 md:px-6 pb-2 flex items-center gap-2 overflow-x-auto">
                                <span className="text-[10px] uppercase tracking-wide text-slate-500 flex-shrink-0">
                                    Recent
                                </span>
                                {recentGeckos.map((g, i) => (
                                    <button
                                        key={g.id}
                                        onClick={() => handleSelectGecko(g.id)}
                                        className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs flex-shrink-0 transition-colors ${
                                            g.id === selectedGeckoId
                                                ? 'bg-emerald-600/20 border-emerald-500/60 text-emerald-200'
                                                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-700'
                                        }`}
                                        title={g.gecko_id_code || g.name}
                                    >
                                        <img
                                            src={g.image_urls?.[0] || DEFAULT_GECKO_IMAGE}
                                            alt=""
                                            className="w-4 h-4 rounded-sm object-cover"
                                            loading="lazy"
                                        />
                                        <span className="truncate max-w-[110px]">{g.name}</span>
                                        {i < recentGeckos.length - 1 && (
                                            <span className="text-slate-600 ml-1">·</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Stats bar */}
                        {stats && (
                            <div className="max-w-7xl mx-auto px-3 md:px-6 pb-3 grid grid-cols-2 md:grid-cols-5 gap-2">
                                <StatPill label="Known ancestors" value={stats.ancestorCount} />
                                <StatPill label="Known depth" value={`${stats.depth}/${generations}`} />
                                <StatPill label="Offspring" value={stats.offspringCount} />
                                <StatPill label="Mates" value={stats.matesCount} />
                                <StatPill
                                    label="COI"
                                    value={`${(stats.coi * 100).toFixed(stats.coi >= 0.01 ? 1 : 2)}%`}
                                    tone={
                                        stats.coi >= 0.25 ? 'danger' :
                                        stats.coi >= 0.0625 ? 'warning' :
                                        'default'
                                    }
                                    tooltip="Coefficient of inbreeding (Wright). Calculated only from known ancestors within the selected generation depth."
                                />
                                {stats.inbreedingAncestors.length > 0 && (
                                    <div className="col-span-2 md:col-span-4 flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200 text-xs">
                                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                        <span>
                                            Possible inbreeding: shared ancestor{stats.inbreedingAncestors.length > 1 ? 's' : ''} on both sides —{' '}
                                            {stats.inbreedingAncestors.map((a) => a.name).join(', ')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.section>
                )}
            </AnimatePresence>

            <main
                ref={mainContentRef}
                className="flex-1 overflow-auto relative touch-none"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Zoom controls - moved to bottom left to avoid overlap */}
                <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
                    <Button size="icon" variant="outline" onClick={() => setScale(s => Math.max(0.3, s - 0.1))} className="bg-slate-800 border-slate-600">
                        <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="bg-slate-800 px-3 py-1 rounded-md text-sm font-mono border border-slate-600">{Math.round(scale * 100)}%</span>
                    <Button size="icon" variant="outline" onClick={() => setScale(s => Math.min(2, s + 0.1))} className="bg-slate-800 border-slate-600">
                        <ZoomIn className="w-4 h-4" />
                    </Button>
                </div>
                
                <div
                    ref={treeAreaRef}
                    className="p-4 md:p-8 min-h-full"
                    style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
                >
                    {isLoadingLineage ? (
                        <div className="w-full h-full flex items-center justify-center pt-20">
                            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                        </div>
                    ) : selectedGeckoId && lineage?.id ? (
                        <div className={`flex flex-col md:flex-row gap-2 md:gap-3 md:items-end md:justify-center`}>
                            {/* Mates Column (Left) */}
                            <div className={`flex-shrink-0 order-2 md:order-1 ${sidePanelWidth}`}>
                                {mates.length > 0 && (
                                    <div className="bg-emerald-950/50 rounded-lg p-2 md:p-3 border border-emerald-800">
                                        <h2 className="text-sm font-bold mb-2 flex items-center justify-center gap-1 text-pink-400">
                                            <Heart className="w-4 h-4" /> Mates
                                        </h2>
                                        <div className={`flex md:grid items-center justify-center gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 ${sidePanelGridCols}`}>
                                            {mates.map(mate => (
                                                <GeckoCardNode
                                                    key={mate.id}
                                                    gecko={mate}
                                                    onNodeClick={handleSelectGecko}
                                                    size={sidePanelCardSize}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Main Lineage Tree (Center) */}
                            <div className="flex-shrink-0 flex flex-col items-center order-1 md:order-2">
                                <h2 className="text-lg font-bold mb-4 text-emerald-400">Ancestry</h2>
                                {renderTree(lineage, 1)}
                            </div>

                            {/* Offspring Column (Right) — column-flowing grid
                                whose row count matches mates so both panels
                                have the same height and top edges line up.
                                Capped at 6 rows desktop / 10 mobile. */}
                            <div className="order-3">
                                {offspring.length > 0 && (
                                    <div className="bg-emerald-950/50 rounded-lg p-2 md:p-3 border border-emerald-800">
                                        <h2 className="text-sm font-bold mb-2 flex items-center justify-center gap-1 text-blue-400">
                                            <Users2 className="w-4 h-4" /> Offspring
                                        </h2>
                                        <div
                                            className="grid grid-flow-col auto-cols-max gap-2 overflow-x-auto pb-2 md:pb-0"
                                            style={{ gridTemplateRows: `repeat(${offspringRows}, minmax(0, max-content))` }}
                                        >
                                            {offspring.map(child => (
                                                <GeckoCardNode
                                                    key={child.id}
                                                    gecko={child}
                                                    onNodeClick={handleSelectGecko}
                                                    size={sidePanelCardSize}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="w-full flex items-center justify-center pt-20">
                            <div className="text-center">
                                <GitBranch className="w-16 h-16 mx-auto text-slate-600 mb-4" />
                                <p className="text-lg text-slate-500">Select a gecko to view lineage</p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            
            {/* Placeholder Edit Modal */}
            <Dialog open={!!editingPlaceholder} onOpenChange={(open) => { if (!open) setEditingPlaceholder(null); }}>
                <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 z-[9999]">
                    <DialogHeader>
                        <DialogTitle>Edit Parent Info: {editingPlaceholder?.name || 'Unknown'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label className="text-slate-300">Name</Label>
                            <Input
                                value={placeholderForm.name}
                                onChange={e => setPlaceholderForm({...placeholderForm, name: e.target.value})}
                                placeholder="Parent gecko name"
                                className="bg-slate-800 border-slate-600 text-slate-100"
                            />
                        </div>
                        <div>
                            <Label className="text-slate-300">Photo</Label>
                            {placeholderForm.image_url && (
                                <img src={placeholderForm.image_url} alt="preview" className="w-20 h-20 object-cover rounded mb-2 border border-slate-600" loading="lazy" decoding="async" />
                            )}
                            <div className="flex gap-2">
                                <Input
                                    value={placeholderForm.image_url}
                                    onChange={e => setPlaceholderForm({...placeholderForm, image_url: e.target.value})}
                                    placeholder="Paste image URL..."
                                    className="bg-slate-800 border-slate-600 text-slate-100 flex-1"
                                />
                                <label className="cursor-pointer">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="sr-only"
                                        onChange={e => handlePlaceholderImageUpload(e.target.files[0])}
                                    />
                                    <div className={`flex items-center gap-1 px-3 py-2 rounded-md border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm h-9 ${isUploadingImage ? 'opacity-50' : ''}`}>
                                        {isUploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                        Upload
                                    </div>
                                </label>
                            </div>
                        </div>
                        <div>
                            <Label className="text-slate-300">Breeder Name</Label>
                            <Input
                                value={placeholderForm.breeder_name}
                                onChange={e => setPlaceholderForm({...placeholderForm, breeder_name: e.target.value})}
                                placeholder="Where this gecko came from"
                                className="bg-slate-800 border-slate-600 text-slate-100"
                            />
                        </div>
                        <div>
                            <Label className="text-slate-300">Breeder Website/Profile</Label>
                            <Input
                                value={placeholderForm.breeder_website}
                                onChange={e => setPlaceholderForm({...placeholderForm, breeder_website: e.target.value})}
                                placeholder="https://..."
                                className="bg-slate-800 border-slate-600 text-slate-100"
                            />
                        </div>
                        <div>
                            <Label className="text-slate-300">Notes</Label>
                            <Textarea
                                value={placeholderForm.notes}
                                onChange={e => setPlaceholderForm({...placeholderForm, notes: e.target.value})}
                                placeholder="Additional information..."
                                className="bg-slate-800 border-slate-600 text-slate-100"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingPlaceholder(null)} className="border-slate-600">
                            Cancel
                        </Button>
                        <Button onClick={handleSavePlaceholder} className="">
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
        </TooltipProvider>
    );
}