import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Filter, X } from 'lucide-react';

const STATUS_OPTIONS = ['Pet', 'Future Breeder', 'Holdback', 'Ready to Breed', 'Proven', 'For Sale', 'Sold'];

export default function GeckoFilters({ filters, onFiltersChange, onClearFilters }) {
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

    const hasActiveFilters = filters.sexes.length > 0 || filters.statuses.length > 0 || 
        filters.traits.length > 0 || filters.weightMin || filters.weightMax;

    return (
        <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-slate-100 flex items-center gap-2">
                        <Filter className="w-5 h-5" />
                        Advanced Filters
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        {hasActiveFilters && (
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={onClearFilters}
                                className="border-slate-600 hover:bg-slate-800"
                            >
                                <X className="w-4 h-4 mr-1" />
                                Clear All
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? 'Hide' : 'Show'}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            
            {isExpanded && (
                <CardContent className="space-y-6">
                    {/* Sex Filter */}
                    <div>
                        <Label className="text-slate-300 mb-2 block">Sex</Label>
                        <div className="flex gap-2">
                            {['Male', 'Female', 'Unsexed'].map(sex => (
                                <button
                                    key={sex}
                                    onClick={() => handleSexToggle(sex)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        filters.sexes.includes(sex)
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                                >
                                    {sex}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Weight Range */}
                    <div>
                        <Label className="text-slate-300 mb-2 block">Weight Range (grams)</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-xs text-slate-400">Min</Label>
                                <Input
                                    type="number"
                                    placeholder="0"
                                    value={filters.weightMin || ''}
                                    onChange={(e) => onFiltersChange({ ...filters, weightMin: e.target.value })}
                                    className="bg-slate-800 border-slate-600"
                                />
                            </div>
                            <div>
                                <Label className="text-xs text-slate-400">Max</Label>
                                <Input
                                    type="number"
                                    placeholder="100"
                                    value={filters.weightMax || ''}
                                    onChange={(e) => onFiltersChange({ ...filters, weightMax: e.target.value })}
                                    className="bg-slate-800 border-slate-600"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <Label className="text-slate-300 mb-2 block">Status</Label>
                        <div className="flex flex-wrap gap-2">
                            {STATUS_OPTIONS.map(status => (
                                <button
                                    key={status}
                                    onClick={() => handleStatusToggle(status)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                        filters.statuses.includes(status)
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Trait Filter */}
                    <div>
                        <Label className="text-slate-300 mb-2 block">Genetic Traits (Press Enter to add)</Label>
                        <Input
                            placeholder="e.g., flame, harlequin, pinstripe..."
                            onKeyDown={handleTraitInput}
                            className="bg-slate-800 border-slate-600"
                        />
                        {filters.traits.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                {filters.traits.map((trait, idx) => (
                                    <Badge 
                                        key={idx}
                                        className="bg-blue-600 hover:bg-blue-700 cursor-pointer"
                                        onClick={() => removeTrait(trait)}
                                    >
                                        {trait}
                                        <X className="w-3 h-3 ml-1" />
                                    </Badge>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-slate-500 mt-2">
                            Geckos must have ALL selected traits to appear
                        </p>
                    </div>
                </CardContent>
            )}
        </Card>
    );
}