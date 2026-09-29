import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ChevronDown, ListFilter, SlidersHorizontal, SortAsc } from "lucide-react";
import { BASE_COLORS, PRIMARY_MORPHS, SECONDARY_TRAITS } from '@/components/morph-id/morphTaxonomy';

// The options come from the Morph ID taxonomy, the same ids gecko_images
// stores. They used to come from GeckoImage.schema(), a call left over from
// the old platform that no longer exists, so all three lists were empty
// and the gallery could only show "All" (fixed 29 Sep 2026).
const byLabel = (a, b) => a.label.localeCompare(b.label);
const OPTIONS = {
    morphs: [...PRIMARY_MORPHS].sort(byLabel).map((m) => m.id),
    traits: [...SECONDARY_TRAITS].sort(byLabel).map((t) => t.id),
    colors: [...BASE_COLORS].sort(byLabel).map((c) => c.id),
};
const LABELS = Object.fromEntries([...PRIMARY_MORPHS, ...SECONDARY_TRAITS, ...BASE_COLORS].map((o) => [o.id, o.label]));

export default function GalleryFilters({ filters, onFilterChange }) {
    const options = OPTIONS;

    const handleFilterChange = (key, value) => {
        onFilterChange(prev => ({ ...prev, [key]: value }));
    };

    const handleTraitToggle = (trait) => {
        const currentTraits = filters.secondary_traits || [];
        const newTraits = currentTraits.includes(trait)
            ? currentTraits.filter(t => t !== trait)
            : [...currentTraits, trait];
        handleFilterChange('secondary_traits', newTraits);
    };

    const formatLabel = (str) => LABELS[str] || str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return (
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-lg shadow-lg mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center"><ListFilter className="w-4 h-4 mr-2"/>Primary Morph</label>
                    <Select value={filters.primary_morph} onValueChange={value => handleFilterChange('primary_morph', value)}>
                        <SelectTrigger className="h-10 bg-slate-800 border-slate-600 text-slate-100 hover:bg-slate-700 focus:ring-slate-500"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600 text-slate-100 z-[99999]">
                            <SelectItem value="all" className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">All Morphs</SelectItem>
                            {options.morphs.map(morph => <SelectItem key={morph} value={morph} className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">{formatLabel(morph)}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center"><ListFilter className="w-4 h-4 mr-2"/>Base Color</label>
                    <Select value={filters.base_color} onValueChange={value => handleFilterChange('base_color', value)}>
                        <SelectTrigger className="h-10 bg-slate-800 border-slate-600 text-slate-100 hover:bg-slate-700 focus:ring-slate-500"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600 text-slate-100 z-[99999]">
                            <SelectItem value="all" className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">All Colors</SelectItem>
                            {options.colors.map(color => <SelectItem key={color} value={color} className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">{formatLabel(color)}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center"><SortAsc className="w-4 h-4 mr-2"/>Sort By</label>
                    <Select value={filters.sort} onValueChange={value => handleFilterChange('sort', value)}>
                        <SelectTrigger className="h-10 bg-slate-800 border-slate-600 text-slate-100 hover:bg-slate-700 focus:ring-slate-500"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600 text-slate-100 z-[99999]">
                            <SelectItem value="-created_date" className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">Newest</SelectItem>
                            <SelectItem value="created_date" className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">Oldest</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full h-10 bg-slate-800 border-slate-600 text-slate-100 hover:bg-slate-700">
                                <SlidersHorizontal className="w-4 h-4 mr-2"/>
                                Secondary Traits
                                {filters.secondary_traits.length > 0 && ` (${filters.secondary_traits.length})`}
                                <ChevronDown className="w-4 h-4 ml-auto" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0 bg-slate-800 border-slate-600 text-slate-100">
                            <div className="p-4 max-h-64 overflow-y-auto space-y-2">
                                {options.traits.map(trait => (
                                    <div key={trait} className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={trait} 
                                            checked={filters.secondary_traits.includes(trait)}
                                            onCheckedChange={() => handleTraitToggle(trait)}
                                            className="border-slate-500 data-[state=checked]:bg-emerald-500"
                                        />
                                        <label htmlFor={trait} className="text-sm font-medium leading-none cursor-pointer">
                                            {formatLabel(trait)}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </div>
    );
}