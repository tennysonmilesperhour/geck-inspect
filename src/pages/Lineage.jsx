import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Gecko, User, BreedingPlan, LineagePlaceholder } from '@/entities/all';
import { Loader2, Users, Search, ZoomIn, ZoomOut, GitBranch, Heart, Users2, Edit2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { base44 } from '@/api/base44Client';
import _ from 'lodash';

const DEFAULT_GECKO_IMAGE = 'https://i.imgur.com/sw9gnDp.png';

// Placeholder card for missing parents
const PlaceholderCardNode = ({ parentName, placeholderData, onEdit, size = 'normal' }) => {
    const cardSize = size === 'tiny' ? 'w-24 h-28' : size === 'small' ? 'w-28 h-32' : 'w-36 h-44';
    const nameSize = size === 'tiny' ? 'text-[10px]' : size === 'small' ? 'text-xs' : 'text-sm';
    const hasData = placeholderData && (placeholderData.image_url || placeholderData.breeder_name);
    
    return (
        <Card
            className={`flex-shrink-0 relative transition-all duration-300 overflow-hidden ${cardSize} bg-slate-800/50 border-2 border-dashed border-slate-600 hover:border-emerald-500 cursor-pointer`}
            onClick={onEdit}
        >
            <div className="w-full h-full bg-slate-700 flex items-center justify-center relative">
                <img 
                    src={placeholderData?.image_url || DEFAULT_GECKO_IMAGE} 
                    alt={parentName || 'Unknown'} 
                    className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute top-1 right-1">
                    <div className="bg-black/60 rounded-full p-1">
                        <Edit2 className="w-3 h-3 text-white" />
                    </div>
                </div>
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
    );
};

// GeckoCardNode component
const GeckoCardNode = ({ gecko, onNodeClick, isSelected, size = 'normal', isFaded = false, className = '' }) => {
    if (!gecko) {
        return <UnknownCardNode size={size} />;
    }
    const hasImage = gecko.image_urls && gecko.image_urls.length > 0;
    
    const sizes = {
        tiny: { card: 'w-24 h-28', name: 'text-[10px]', id: 'text-[9px]', icon: 'w-6 h-6' },
        small: { card: 'w-28 h-32', name: 'text-xs', id: 'text-[10px]', icon: 'w-8 h-8' },
        normal: { card: 'w-36 h-44', name: 'text-sm', id: 'text-xs', icon: 'w-10 h-10' },
    };
    const { card: cardSize, name: nameTextSize, id: idTextSize, icon: iconSize } = sizes[size] || sizes.normal;
    
    const sexIcon = gecko.sex === 'Male' ? '♂' : gecko.sex === 'Female' ? '♀' : '?';
    const sexColor = gecko.sex === 'Male' ? 'text-blue-400' : gecko.sex === 'Female' ? 'text-pink-400' : 'text-gray-400';
    
    return (
        <Card
            className={`flex-shrink-0 relative transition-all duration-300 overflow-hidden ${cardSize} ${className} ${isSelected ? 'ring-2 ring-emerald-400 shadow-2xl z-10' : 'shadow-lg'} bg-slate-800/80 backdrop-blur-sm border-slate-700 hover:shadow-xl hover:ring-2 hover:ring-emerald-500/50 cursor-pointer ${isFaded ? 'opacity-50' : ''}`}
            onClick={(e) => { e.stopPropagation(); onNodeClick(gecko.id); }}
        >
            <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                <img 
                    src={hasImage ? gecko.image_urls[0] : DEFAULT_GECKO_IMAGE} 
                    alt={gecko.name} 
                    className="w-full h-full object-cover" 
                />
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/80 to-transparent">
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
            />
            <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                <span className="text-xs text-slate-400">Unknown</span>
            </div>
        </div>
    );
};


export default function Lineage() {
    const location = useLocation();
    const [myGeckos, setMyGeckos] = useState([]);
    const [allGeckosMap, setAllGeckosMap] = useState({});
    const [allBreedingPlans, setAllBreedingPlans] = useState([]);
    const [placeholders, setPlaceholders] = useState({});
    
    const [selectedGeckoId, setSelectedGeckoId] = useState(null);
    const [lineage, setLineage] = useState({});
    const [mates, setMates] = useState([]);
    const [offspring, setOffspring] = useState([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingLineage, setIsLoadingLineage] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [scale, setScale] = useState(1);
    const [generations, setGenerations] = useState(3);
    const mainContentRef = useRef(null);
    
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
            const currentUser = await base44.auth.me();
            const [userGeckos, allVisibleGeckos, userPlaceholders] = await Promise.all([
                Gecko.filter({ created_by: currentUser.email }),
                Gecko.list(),
                LineagePlaceholder.filter({ created_by: currentUser.email }).catch(() => [])
            ]);
            
            let breedingPlans = [];
            try {
                breedingPlans = await BreedingPlan.filter({ created_by: currentUser.email });
            } catch (error) {
                console.warn("Could not load breeding plans:", error);
            }
            
            setMyGeckos(userGeckos);
            setAllGeckosMap(_.keyBy(allVisibleGeckos, 'id'));
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
        
        const lineageData = await getLineageFor(geckoId, generations);
        setLineage(lineageData || {});

        const foundOffspring = Object.values(allGeckosMap).filter(g => g.sire_id === geckoId || g.dam_id === geckoId);
        setOffspring(foundOffspring);

        const mateIds = new Set();
        allBreedingPlans.forEach(plan => {
            if (plan.sire_id === geckoId) mateIds.add(plan.dam_id);
            if (plan.dam_id === geckoId) mateIds.add(plan.sire_id);
        });
        const foundMates = Array.from(mateIds).map(id => allGeckosMap[id]).filter(Boolean);
        setMates(foundMates);
        
        setIsLoadingLineage(false);
    }, [getLineageFor, allGeckosMap, allBreedingPlans, generations]);

    // Re-fetch lineage when generations change
    useEffect(() => {
        if (selectedGeckoId) {
            handleSelectGecko(selectedGeckoId);
        }
    }, [generations]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const geckoIdFromUrl = params.get('geckoId');
        
        if (geckoIdFromUrl && allGeckosMap[geckoIdFromUrl] && !isLoading && geckoIdFromUrl !== selectedGeckoId) {
            handleSelectGecko(geckoIdFromUrl);
        }
    }, [location.search, allGeckosMap, isLoading, handleSelectGecko, selectedGeckoId]);

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
    const renderNode = (gecko, generation) => {
        if (!gecko) return null;
        
        const cardSize = getCardSize(generation);
        
        if (gecko.isPlaceholder) {
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
        
        return (
            <GeckoCardNode 
                gecko={gecko} 
                onNodeClick={handleSelectGecko} 
                isSelected={selectedGeckoId === gecko.id} 
                size={cardSize} 
            />
        );
    };

    // Render the tree recursively - parents above, child below
    const renderTree = (gecko, generation) => {
        if (!gecko) return null;
        
        const hasSire = gecko.sire;
        const hasDam = gecko.dam;
        const hasParents = hasSire || hasDam;
        
        return (
            <div className="flex flex-col items-center">
                {/* Parents Row */}
                {hasParents && (
                    <>
                        <div className="flex gap-2 md:gap-4">
                            <div className="flex flex-col items-center">
                                {renderTree(gecko.sire, generation + 1)}
                            </div>
                            <div className="flex flex-col items-center">
                                {renderTree(gecko.dam, generation + 1)}
                            </div>
                        </div>
                        {/* Connecting lines */}
                        <div className="flex items-center justify-center w-full">
                            <div className="h-4 w-px bg-emerald-700"></div>
                        </div>
                        <div className="flex items-center justify-center">
                            <div className="w-1/4 h-px bg-emerald-700"></div>
                            <div className="h-4 w-px bg-emerald-700"></div>
                            <div className="w-1/4 h-px bg-emerald-700"></div>
                        </div>
                    </>
                )}
                
                {/* Current Node */}
                {renderNode(gecko, generation)}
            </div>
        );
    };

    const filteredSelectableGeckos = myGeckos.filter(g => 
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        g.gecko_id_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden">
            <header className="p-3 md:p-4 border-b border-slate-700 flex-shrink-0 z-20 bg-slate-950/80 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3">
                    <div className="text-center md:text-left">
                        <h1 className="text-xl md:text-2xl font-bold text-slate-100">Gecko Lineage</h1>
                        <p className="text-slate-400 text-sm hidden md:block">Select a gecko to view its family tree</p>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative flex-grow md:flex-grow-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                            <Input
                                type="text" 
                                placeholder="Search..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 w-full md:w-48 h-10"
                            />
                        </div>
                        <Select onValueChange={handleSelectGecko} value={selectedGeckoId || ''}>
                            <SelectTrigger className="w-full md:w-[200px] h-10">
                                <SelectValue placeholder="Select gecko" />
                            </SelectTrigger>
                            <SelectContent>
                                {isLoading ? (
                                    <div className="flex items-center justify-center p-2 text-emerald-300"><Loader2 className="animate-spin w-4 h-4 mr-2" /> Loading...</div>
                                ) : (
                                    filteredSelectableGeckos.map(gecko => (
                                        <SelectItem key={gecko.id} value={gecko.id}>
                                            {gecko.name} ({gecko.gecko_id_code || 'No ID'})
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                        <Select value={generations.toString()} onValueChange={(v) => setGenerations(parseInt(v))}>
                            <SelectTrigger className="w-24 h-10">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="2">2 Gen</SelectItem>
                                <SelectItem value="3">3 Gen</SelectItem>
                                <SelectItem value="4">4 Gen</SelectItem>
                                <SelectItem value="5">5 Gen</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </header>
            
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
                    className="p-4 md:p-8 min-h-full" 
                    style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
                >
                    {isLoadingLineage ? (
                        <div className="w-full h-full flex items-center justify-center pt-20">
                            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                        </div>
                    ) : selectedGeckoId && lineage?.id ? (
                        <div className="flex flex-col md:flex-row gap-8">
                            {/* Mates Column (Left) */}
                            <div className="md:w-36 flex-shrink-0 order-2 md:order-1">
                                {mates.length > 0 && (
                                    <div className="bg-emerald-950/50 rounded-lg p-3 border border-emerald-800">
                                        <h2 className="text-sm font-bold mb-3 flex items-center justify-center gap-1 text-pink-400">
                                            <Heart className="w-4 h-4" /> Mates
                                        </h2>
                                        <div className="flex md:flex-col items-center justify-center gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
                                            {mates.map(mate => (
                                                <GeckoCardNode 
                                                    key={mate.id} 
                                                    gecko={mate} 
                                                    onNodeClick={handleSelectGecko} 
                                                    size="small"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Main Lineage Tree (Center) */}
                            <div className="flex-1 flex flex-col items-center order-1 md:order-2">
                                <h2 className="text-lg font-bold mb-4 text-emerald-400">Ancestry</h2>
                                {renderTree(lineage, 1)}
                            </div>

                            {/* Offspring Column (Right) */}
                            <div className="md:w-36 flex-shrink-0 order-3">
                                {offspring.length > 0 && (
                                    <div className="bg-emerald-950/50 rounded-lg p-3 border border-emerald-800">
                                        <h2 className="text-sm font-bold mb-3 flex items-center justify-center gap-1 text-blue-400">
                                            <Users2 className="w-4 h-4" /> Offspring
                                        </h2>
                                        <div className="flex md:flex-col items-center justify-center gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
                                            {offspring.map(child => (
                                                <GeckoCardNode 
                                                    key={child.id} 
                                                    gecko={child} 
                                                    onNodeClick={handleSelectGecko} 
                                                    size="small"
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
            <Dialog open={!!editingPlaceholder} onOpenChange={() => setEditingPlaceholder(null)}>
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
                            <Label className="text-slate-300">Image URL (optional)</Label>
                            <Input
                                value={placeholderForm.image_url}
                                onChange={e => setPlaceholderForm({...placeholderForm, image_url: e.target.value})}
                                placeholder="https://..."
                                className="bg-slate-800 border-slate-600 text-slate-100"
                            />
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
                        <Button onClick={handleSavePlaceholder} className="bg-emerald-600 hover:bg-emerald-700">
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}