import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Filter, X } from 'lucide-react';
import { MORPH_CATEGORIES } from './MorphIDSelector';
import { GECKO_STATUS_OPTIONS as STATUS_OPTIONS, GECKO_SEX_OPTIONS } from '@/lib/constants';
const SPECIES_OPTIONS = [
    'Crested Gecko', 'Gargoyle Gecko', 'Giant Day Gecko', 'Gold Dust Day Gecko',
    'Leachianus Gecko', 'Mourning Gecko', 'Chahoua Gecko', 'Pictus Gecko',
    'Tokay Gecko', 'Leopard Gecko', 'African Fat-Tailed Gecko', 'Other'
];

export default function GeckoFilters({ filters, onFiltersChange, onClearFilters, feedingGroups = [] }) {
    const [isExpanded, setIsExpanded] = React.useState(false);

    const handleSexToggle = (sex) => {
        const newSexes = filters.sexes.includes(sex)
            ? filters.sexes.filter(s => s !== sex)
            : [...filters.sexes, sex];
        onFiltersChange({ ...filters, sexes: newSexes });
    };

    const handleStatusToggle = (status) => {
        const newStatuses = filters.statuses.includes(status)
            ? filters.statuses.filter(s => s !== status)
            : [...filters.statuses, status];
        onFiltersChange({ ...filters, statuses: newStatuses });
    };

    const handleTraitInput = (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            const newTraits = [...filters.traits, e.target.value.trim()];
            onFiltersChange({ ...filters, traits: newTraits });
            e.target.value = '';
        }
    };

    const removeTrait = (trait) => {
        onFiltersChange({ ...filters, traits: filters.traits.filter(t => t !== trait) });
    };

    const toggleMorphTag = (tag) => {
        const current = filters.morphTags || [];
        const updated = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
        onFiltersChange({ ...filters, morphTags: updated });
    };

    const toggleFeedingGroup = (groupId) => {
        const current = filters.feedingGroupIds || [];
        const updated = current.includes(groupId) ? current.filter(g => g !== groupId) : [...current, groupId];
        onFiltersChange({ ...filters, feedingGroupIds: updated });
    };

    const handleSpeciesToggle = (species) => {
        const current = filters.species || [];
        const updated = current.includes(species) ? current.filter(s => s !== species) : [...current, species];
        onFiltersChange({ ...filters, species: updated });
    };

    const hasActiveFilters = filters.sexes.length > 0 || filters.statuses.length > 0 || 
        filters.traits.length > 0 || filters.weightMin || filters.weightMax ||
        (filters.morphTags?.length > 0) || (filters.feedingGroupIds?.length > 0) ||
        (filters.species?.length > 0);

    const _allMorphs = Object.values(MORPH_CATEGORIES).flatMap(c => c.morphs);

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-900/80 transition-colors"
            >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <Filter className="w-4 h-4 text-slate-400" />
                    Advanced Filters
                    {hasActiveFilters && (
                        <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0 h-4">
                            Active
                        </Badge>
                    )}
                </span>
                <div className="flex items-center gap-2">
                    {hasActiveFilters && (
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                                e.stopPropagation();
                                onClearFilters();
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.stopPropagation();
                                    onClearFilters();
                                }
                            }}
                            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                        >
                            <X className="w-3 h-3" /> Clear all
                        </span>
                    )}
                    <span className="text-xs text-slate-400">
                        {isExpanded ? 'Hide' : 'Show'}
                    </span>
                </div>
            </button>

            {isExpanded && (
                <div className="px-4 py-4 space-y-6 border-t border-slate-800">
                    {/* Species Filter */}
                    <div>
                        <Label className="text-slate-300 mb-2 block">Species</Label>
                        <div className="flex flex-wrap gap-2">
                            {SPECIES_OPTIONS.map(species => (
                                <button key={species} onClick={() => handleSpeciesToggle(species)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${(filters.species || []).includes(species) ? 'bg-teal-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                                    {species}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sex Filter */}
                    <div>
                        <Label className="text-slate-300 mb-2 block">Sex</Label>
                        <div className="flex gap-2">
                            {GECKO_SEX_OPTIONS.map(sex => (
                                <button key={sex} onClick={() => handleSexToggle(sex)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filters.sexes.includes(sex) ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                                    {sex}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <Label className="text-slate-300 mb-2 block">Status</Label>
                        <div className="flex flex-wrap gap-2">
                            {STATUS_OPTIONS.map(status => (
                                <button key={status} onClick={() => handleStatusToggle(status)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filters.statuses.includes(status) ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Feeding Group Filter */}
                    {feedingGroups.length > 0 && (
                        <div>
                            <Label className="text-slate-300 mb-2 block">Feeding Group</Label>
                            <div className="flex flex-wrap gap-2">
                                {feedingGroups.map(group => (
                                    <button key={group.id} onClick={() => toggleFeedingGroup(group.id)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                                            (filters.feedingGroupIds || []).includes(group.id) ? 'text-white ring-2 ring-white/50' : 'text-white/80 hover:opacity-90'
                                        }`}
                                        style={{ backgroundColor: group.color || '#f97316' }}>
                                        <span className="font-bold">{group.label}</span>
                                        {group.name && <span>{group.name}</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Morph Tag Filter */}
                    <div>
                        <Label className="text-slate-300 mb-2 block">Morph Tags</Label>
                        {(filters.morphTags?.length > 0) && (
                            <div className="flex flex-wrap gap-1 mb-3">
                                {filters.morphTags.map(tag => (
                                    <Badge key={tag} className="bg-purple-600 hover:bg-red-600 cursor-pointer text-white" onClick={() => toggleMorphTag(tag)}>
                                        {tag} <X className="w-3 h-3 ml-1" />
                                    </Badge>
                                ))}
                            </div>
                        )}
                        <div className="max-h-48 overflow-y-auto space-y-3 border border-slate-700 rounded-lg p-3 bg-slate-800/50">
                            {Object.entries(MORPH_CATEGORIES).map(([cat, { color, morphs }]) => (
                                <div key={cat}>
                                    <div className={`text-xs font-semibold text-slate-400 mb-1`}>{cat}</div>
                                    <div className="flex flex-wrap gap-1">
                                        {morphs.map(m => (
                                            <button key={m} type="button" onClick={() => toggleMorphTag(m)}
                                                className={`text-xs px-2 py-0.5 rounded-full transition-all ${
                                                    (filters.morphTags || []).includes(m)
                                                        ? 'bg-purple-600 text-white'
                                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                                }`}>
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Geckos must have ALL selected tags to appear</p>
                    </div>

                    {/* Weight Range */}
                    <div>
                        <Label className="text-slate-300 mb-2 block">Weight Range (grams)</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-xs text-slate-400">Min</Label>
                                <Input type="number" placeholder="0" value={filters.weightMin || ''} onChange={(e) => onFiltersChange({ ...filters, weightMin: e.target.value })} className="bg-slate-800 border-slate-600" />
                            </div>
                            <div>
                                <Label className="text-xs text-slate-400">Max</Label>
                                <Input type="number" placeholder="100" value={filters.weightMax || ''} onChange={(e) => onFiltersChange({ ...filters, weightMax: e.target.value })} className="bg-slate-800 border-slate-600" />
                            </div>
                        </div>
                    </div>

                    {/* Free-text Trait Filter */}
                    <div>
                        <Label className="text-slate-300 mb-2 block">Free Text Traits (Press Enter to add)</Label>
                        <Input placeholder="e.g., flame, harlequin, pinstripe..." onKeyDown={handleTraitInput} className="bg-slate-800 border-slate-600" />
                        {filters.traits.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                {filters.traits.map((trait, idx) => (
                                    <Badge key={idx} className="bg-blue-600 hover:bg-blue-700 cursor-pointer" onClick={() => removeTrait(trait)}>
                                        {trait} <X className="w-3 h-3 ml-1" />
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}