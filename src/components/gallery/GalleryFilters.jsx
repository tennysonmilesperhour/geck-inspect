import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ChevronDown, ListFilter, SlidersHorizontal, SortAsc } from "lucide-react";
import { GeckoImage } from '@/entities/GeckoImage';

export default function GalleryFilters({ filters, onFilterChange }) {
    const [options, setOptions] = useState({ morphs: [], traits: [], colors: [] });

    useEffect(() => {
        const fetchFilterOptions = async () => {
            try {
                const schema = await GeckoImage.schema();
                const morphs = schema.properties.primary_morph?.enum.sort() || [];
                const traits = schema.properties.secondary_traits?.items?.enum.sort() || [];
                const colors = schema.properties.base_color?.enum.sort() || [];
                setOptions({ morphs, traits, colors });
            } catch (error) {
                console.error("Failed to load filter options from schema:", error);
            }
        };
        fetchFilterOptions();
    }, []);

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

    const formatLabel = (str) => str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return (
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-lg shadow-lg mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center"><ListFilter className="w-4 h-4 mr-2"/>Primary Morph</label>
                    <Select value={filters.primary_morph} onValueChange={value => handleFilterChange('primary_morph', value)}>
                        <SelectTrigger className="h-10 bg-emerald-950 border-emerald-700 text-emerald-100 hover:bg-emerald-900 focus:ring-emerald-500"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-emerald-950 border-emerald-700 text-emerald-100 z-[99999]">
                            <SelectItem value="all" className="text-emerald-100 focus:bg-emerald-600 focus:text-white hover:bg-emerald-800">All Morphs</SelectItem>
                            {options.morphs.map(morph => <SelectItem key={morph} value={morph} className="text-emerald-100 focus:bg-emerald-600 focus:text-white hover:bg-emerald-800">{formatLabel(morph)}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center"><ListFilter className="w-4 h-4 mr-2"/>Base Color</label>
                    <Select value={filters.base_color} onValueChange={value => handleFilterChange('base_color', value)}>
                        <SelectTrigger className="h-10 bg-emerald-950 border-emerald-700 text-emerald-100 hover:bg-emerald-900 focus:ring-emerald-500"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-emerald-950 border-emerald-700 text-emerald-100 z-[99999]">
                            <SelectItem value="all" className="text-emerald-100 focus:bg-emerald-600 focus:text-white hover:bg-emerald-800">All Colors</SelectItem>
                            {options.colors.map(color => <SelectItem key={color} value={color} className="text-emerald-100 focus:bg-emerald-600 focus:text-white hover:bg-emerald-800">{formatLabel(color)}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center"><SortAsc className="w-4 h-4 mr-2"/>Sort By</label>
                    <Select value={filters.sort} onValueChange={value => handleFilterChange('sort', value)}>
                        <SelectTrigger className="h-10 bg-emerald-950 border-emerald-700 text-emerald-100 hover:bg-emerald-900 focus:ring-emerald-500"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-emerald-950 border-emerald-700 text-emerald-100 z-[99999]">
                            <SelectItem value="-created_date" className="text-emerald-100 focus:bg-emerald-600 focus:text-white hover:bg-emerald-800">Newest</SelectItem>
                            <SelectItem value="created_date" className="text-emerald-100 focus:bg-emerald-600 focus:text-white hover:bg-emerald-800">Oldest</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full h-10 bg-emerald-950 border-emerald-700 text-emerald-100 hover:bg-emerald-900">
                                <SlidersHorizontal className="w-4 h-4 mr-2"/>
                                Secondary Traits
                                {filters.secondary_traits.length > 0 && ` (${filters.secondary_traits.length})`}
                                <ChevronDown className="w-4 h-4 ml-auto" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0 bg-emerald-950 border-emerald-700 text-emerald-100">
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