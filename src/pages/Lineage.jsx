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

// Placeholder card for missing parents
const PlaceholderCardNode = ({ parentName, placeholderData, onEdit, size = 'normal' }) => {
    const cardSize = size === 'tiny' ? 'w-24 h-32' : size === 'small' ? 'w-32 h-40' : 'w-40 h-48';
    const nameSize = size === 'tiny' ? 'text-[11px]' : size === 'small' ? 'text-xs' : 'text-sm';
    const hasData = placeholderData && (placeholderData.image_url || placeholderData.breeder_name);
    
    return (
        <Card
            className={`flex-shrink-0 relative transition-all duration-300 overflow-hidden ${cardSize} bg-slate-800/50 border-2 border-dashed border-slate-600 hover:border-emerald-500 cursor-pointer`}
            onClick={onEdit}
        >
            <div className="w-full h-full bg-slate-700 flex items-center justify-center relative">
                {placeholderData?.image_url ? (
                    <img src={placeholderData.image_url} alt={parentName} className="w-full h-full object-cover" />
                ) : (
                    <Users className="w-12 h-12 text-slate-500" />
                )}
                <div className="absolute top-2 right-2">
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
                    <p className="text-[10px] text-slate-400 truncate">
                        From: {placeholderData.breeder_name}
                    </p>
                )}
            </div>
        </Card>
    );
};

// A more robust GeckoCardNode that can be reused
const GeckoCardNode = ({ gecko, onNodeClick, isSelected, size = 'normal', isFaded = false, className = '' }) => {
    if (!gecko) {
        return <UnknownCardNode size={size} />;
    }
    const hasImage = gecko.image_urls && gecko.image_urls.length > 0;
    
    const sizes = {
        tiny: { card: 'w-24 h-32', name: 'text-[11px]', id: 'text-[9px]', icon: 'w-6 h-6' },
        small: { card: 'w-32 h-40', name: 'text-xs', id: 'text-[10px]', icon: 'w-8 h-8' },
        normal: { card: 'w-40 h-48', name: 'text-sm', id: 'text-xs', icon: 'w-12 h-12' },
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
                {hasImage ? (
                    <img src={gecko.image_urls[0]} alt={gecko.name} className="w-full h-full object-cover" />
                ) : (
                    <Users className={`${iconSize} text-slate-500`} />
                )}
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center gap-1">
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
    const cardSize = size === 'tiny' ? 'w-24 h-32' : size === 'small' ? 'w-32 h-40' : 'w-40 h-48';
    return (
        <div className={`flex-shrink-0 flex flex-col items-center justify-center bg-slate-800/50 border-2 border-dashed border-slate-600 rounded-lg ${cardSize}`}>
            <Users className={`${size === 'tiny' ? 'w-6 h-6' : 'w-8 h-8'} text-slate-500 mb-2`} />
            <span className="text-xs text-slate-500">Unknown</span>
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
    const mainContentRef = useRef(null);
    
    // Placeholder editing
    const [editingPlaceholder, setEditingPlaceholder] = useState(null);
    const [placeholderForm, setPlaceholderForm] = useState({
        name: '',
        image_url: '',
        breeder_name: '',
        breeder_website: '',
        notes: ''
    });

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        try {
            const currentUser = await base44.auth.me();
            const [userGeckos, allVisibleGeckos, userPlaceholders] = await Promise.all([
                Gecko.filter({ created_by: currentUser.email }),
                Gecko.list(),
                LineagePlaceholder.filter({ created_by: currentUser.email }).catch(() => [])
            ]);
            
            // Fetch breeding plans safely
            let breedingPlans = [];
            try {
                breedingPlans = await BreedingPlan.filter({ created_by: currentUser.email });
            } catch (error) {
                console.warn("Could not load breeding plans:", error);
            }
            
            setMyGeckos(userGeckos);
            setAllGeckosMap(_.keyBy(allVisibleGeckos, 'id'));
            setAllBreedingPlans(breedingPlans);
            
            // Index placeholders by gecko_id and parent_type
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

    // Auto-select gecko from URL parameter
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const geckoIdFromUrl = params.get('geckoId');
        
        if (geckoIdFromUrl && allGeckosMap[geckoIdFromUrl] && !isLoading) {
            handleSelectGecko(geckoIdFromUrl);
        }
    }, [location.search, allGeckosMap, isLoading]);

    const getLineageFor = useCallback(async (geckoId, generations = 3, currentGen = 1) => {
        if (currentGen > generations || !geckoId) {
            return null;
        }
        const gecko = allGeckosMap[geckoId];
        if (!gecko) return null;

        // Build sire and dam - either from collection or from names
        let sire = null;
        let dam = null;
        
        if (gecko.sire_id) {
            sire = await getLineageFor(gecko.sire_id, generations, currentGen + 1);
        } else if (gecko.sire_name) {
            // Create placeholder object for display
            sire = { 
                name: gecko.sire_name, 
                isPlaceholder: true, 
                geckoId: gecko.id,
                parentType: 'sire'
            };
        }
        
        if (gecko.dam_id) {
            dam = await getLineageFor(gecko.dam_id, generations, currentGen + 1);
        } else if (gecko.dam_name) {
            // Create placeholder object for display
            dam = { 
                name: gecko.dam_name, 
                isPlaceholder: true, 
                geckoId: gecko.id,
                parentType: 'dam'
            };
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
        
        const lineageData = await getLineageFor(geckoId, 3);
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
    }, [getLineageFor, allGeckosMap, allBreedingPlans]);

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
            
            // Refresh placeholders
            await fetchAllData();
            setEditingPlaceholder(null);
        } catch (error) {
            console.error("Failed to save placeholder:", error);
        }
    };

    const renderGeneration = (gecko, generation) => {
        if (!gecko) {
            return <UnknownCardNode size={generation >= 2 ? 'small' : 'normal'} />;
        }
        
        const cardSize = generation >= 2 ? 'small' : 'normal';
        
        // Handle placeholder parents
        if (gecko.isPlaceholder) {
            const key = `${gecko.geckoId}_${gecko.parentType}`;
            const placeholderData = placeholders[key];
            
            return (
                <div className="flex items-center">
                    <PlaceholderCardNode 
                        parentName={gecko.name}
                        placeholderData={placeholderData}
                        onEdit={() => handleEditPlaceholder(gecko, gecko.parentType)}
                        size={cardSize}
                    />
                </div>
            );
        }

        return (
            <div className="flex items-center">
                <GeckoCardNode gecko={gecko} onNodeClick={handleSelectGecko} isSelected={selectedGeckoId === gecko.id} size={cardSize} />
                {(gecko.sire || gecko.dam) && (
                    <>
                        <div className="w-4 md:w-8 border-t-2 border-slate-600"></div>
                        <div className="flex flex-col gap-2 md:gap-4 relative">
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-full w-[2px] bg-slate-600"></div>
                           <div className="absolute left-0 top-0 h-[2px] w-4 bg-slate-600"></div>
                          <div className="absolute left-0 bottom-0 h-[2px] w-4 bg-slate-600"></div>
                        </div>
                    </>
                )}
                <div className="flex flex-col gap-2 md:gap-4">
                    {gecko.sire && renderGeneration(gecko.sire, generation + 1)}
                    {gecko.dam && renderGeneration(gecko.dam, generation + 1)}
                </div>
            </div>
        );
    };

    const filteredSelectableGeckos = myGeckos.filter(g => 
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        g.gecko_id_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden">
            <header className="p-4 border-b border-slate-700 flex-shrink-0 z-20 bg-slate-950/80 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                     <div>
                        <h1 className="text-2xl font-bold text-slate-100">Gecko Lineage Viewer</h1>
                        <p className="text-slate-400">Select a gecko to view its family tree, mates, and offspring.</p>
                    </div>
                     <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-grow">
                             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                type="text" placeholder="Search your geckos..." value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-slate-800 border-slate-600 w-full md:w-64"
                            />
                        </div>
                        <Select onValueChange={handleSelectGecko} value={selectedGeckoId || ''}>
                            <SelectTrigger className="w-full md:w-[250px] bg-slate-800 border-slate-600">
                                <SelectValue placeholder="Select a gecko" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                {isLoading ? (
                                    <div className="flex items-center justify-center p-2"><Loader2 className="animate-spin w-4 h-4 mr-2" /> Loading...</div>
                                ) : (
                                    filteredSelectableGeckos.map(gecko => (
                                        <SelectItem key={gecko.id} value={gecko.id}>{gecko.name} ({gecko.gecko_id_code})</SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                     </div>
                </div>
            </header>
            <main ref={mainContentRef} className="flex-1 overflow-auto relative">
                 <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                    <Button size="icon" variant="outline" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}><ZoomOut className="w-4 h-4" /></Button>
                    <span className="bg-slate-900/80 px-3 py-1 rounded-md text-sm font-mono">{Math.round(scale * 100)}%</span>
                    <Button size="icon" variant="outline" onClick={() => setScale(s => Math.min(1.5, s + 0.1))}><ZoomIn className="w-4 h-4" /></Button>
                </div>
                
                <div className="p-8 min-h-full min-w-max" style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                    {isLoadingLineage ? (
                         <div className="w-full h-full flex items-center justify-center"><Loader2 className="w-12 h-12 text-emerald-500 animate-spin" /></div>
                    ) : selectedGeckoId && lineage?.id ? (
                        <div className="space-y-12">
                            {/* Ancestor Tree */}
                            <div className="flex">
                                {renderGeneration(lineage, 1)}
                            </div>
                            {/* Mates and Offspring */}
                            <div className="space-y-8 pt-8 border-t-2 border-slate-700">
                                {mates.length > 0 && (
                                     <div>
                                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Heart/> Mates ({mates.length})</h2>
                                        <div className="flex gap-4 overflow-x-auto pb-4">
                                            {mates.map(mate => <GeckoCardNode key={mate.id} gecko={mate} onNodeClick={handleSelectGecko} size="small"/>)}
                                        </div>
                                    </div>
                                )}
                                {offspring.length > 0 && (
                                     <div>
                                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Users2/> Offspring ({offspring.length})</h2>
                                         <div className="flex gap-4 overflow-x-auto pb-4">
                                            {offspring.map(child => <GeckoCardNode key={child.id} gecko={child} onNodeClick={handleSelectGecko} size="small"/>)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                         <div className="w-full h-full flex items-center justify-center text-slate-500 fixed inset-0">
                            <div className="text-center">
                                <GitBranch className="w-16 h-16 mx-auto text-slate-600 mb-4" />
                                <p className="text-lg">Select a gecko from the dropdown to begin exploring lineages.</p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            
            {/* Placeholder Edit Modal */}
            <Dialog open={!!editingPlaceholder} onOpenChange={() => setEditingPlaceholder(null)}>
                <DialogContent className="bg-slate-900 border-slate-700 text-slate-200">
                    <DialogHeader>
                        <DialogTitle>Edit Parent Info: {editingPlaceholder?.name || 'Unknown'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Name</Label>
                            <Input
                                value={placeholderForm.name}
                                onChange={e => setPlaceholderForm({...placeholderForm, name: e.target.value})}
                                placeholder="Parent gecko name"
                                className="bg-slate-800 border-slate-600"
                            />
                        </div>
                        <div>
                            <Label>Image URL (optional)</Label>
                            <Input
                                value={placeholderForm.image_url}
                                onChange={e => setPlaceholderForm({...placeholderForm, image_url: e.target.value})}
                                placeholder="https://..."
                                className="bg-slate-800 border-slate-600"
                            />
                        </div>
                        <div>
                            <Label>Breeder Name</Label>
                            <Input
                                value={placeholderForm.breeder_name}
                                onChange={e => setPlaceholderForm({...placeholderForm, breeder_name: e.target.value})}
                                placeholder="Where this gecko came from"
                                className="bg-slate-800 border-slate-600"
                            />
                        </div>
                        <div>
                            <Label>Breeder Website/Profile</Label>
                            <Input
                                value={placeholderForm.breeder_website}
                                onChange={e => setPlaceholderForm({...placeholderForm, breeder_website: e.target.value})}
                                placeholder="https://..."
                                className="bg-slate-800 border-slate-600"
                            />
                        </div>
                        <div>
                            <Label>Notes</Label>
                            <Textarea
                                value={placeholderForm.notes}
                                onChange={e => setPlaceholderForm({...placeholderForm, notes: e.target.value})}
                                placeholder="Additional information..."
                                className="bg-slate-800 border-slate-600"
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