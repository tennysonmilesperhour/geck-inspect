import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dna, ChevronDown, ChevronUp } from 'lucide-react';

const MORPH_CATEGORIES = {
    "Base Patterns": {
        color: "bg-emerald-900/50 border-emerald-700",
        badge: "bg-emerald-700",
        morphs: ["Flame", "Harlequin", "Extreme Harlequin", "Pinstripe", "Phantom Pinstripe", "Tiger", "Brindle", "Extreme Brindle", "Patternless", "Bicolor", "Tricolor"]
    },
    "Dalmatian": {
        color: "bg-blue-900/50 border-blue-700",
        badge: "bg-blue-700",
        morphs: ["Dalmatian", "Super Dalmatian", "Ink Spots", "Oil Spots", "Red Spots", "Super Spots"]
    },
    "Structure & Texture": {
        color: "bg-purple-900/50 border-purple-700",
        badge: "bg-purple-700",
        morphs: ["Lilly White", "Soft Scale", "Super Soft Scale", "White Wall", "Empty Back"]
    },
    "Color Traits": {
        color: "bg-yellow-900/50 border-yellow-700",
        badge: "bg-yellow-700",
        morphs: ["Axanthic", "Cappuccino", "Frappuccino", "Hypo", "Translucent", "Moonglow", "Red Base", "Yellow Base", "Orange Base", "Olive", "Chocolate", "Lavender", "Buckskin"]
    },
    "Harlequin Variants": {
        color: "bg-pink-900/50 border-pink-700",
        badge: "bg-pink-700",
        morphs: ["Red Harlequin", "Yellow Harlequin", "Cream Harlequin", "Orange Harlequin", "Extreme Red Harlequin"]
    },
    "Secondary Traits": {
        color: "bg-orange-900/50 border-orange-700",
        badge: "bg-orange-700",
        morphs: ["Super Stripe", "Partial Pinstripe", "Dashed Pinstripe", "Reverse Pinstripe", "Phantom", "White Fringe", "Side Stripe", "Crowned", "Quad Stripe", "Chevron Pattern", "Diamond Pattern", "Reticulated", "Mottled", "Speckled"]
    },
    "Crest & Body Markings": {
        color: "bg-teal-900/50 border-teal-700",
        badge: "bg-teal-700",
        morphs: ["White Tipped Crests", "Colored Crests", "Drippy Dorsal", "Kneecaps", "Portholes", "Furred Trait", "Fired Up", "Fired Down", "Tiger Striping", "Banded", "Broken Banding"]
    }
};

export default function MorphIDSelector({ selectedMorphs = [], onMorphsChange }) {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMorph = (morph) => {
        if (selectedMorphs.includes(morph)) {
            onMorphsChange(selectedMorphs.filter(m => m !== morph));
        } else {
            onMorphsChange([...selectedMorphs, morph]);
        }
    };

    const totalSelected = selectedMorphs.length;

    return (
        <div className="space-y-2">
            <Button
                type="button"
                variant="outline"
                className="w-full border-purple-600 text-purple-300 hover:bg-purple-900/20 flex items-center justify-between"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    <Dna className="w-4 h-4" />
                    <span>Morph ID Tags {totalSelected > 0 ? `(${totalSelected} selected)` : ''}</span>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>

            {isOpen && (
                <div className="border border-slate-700 rounded-lg p-3 space-y-4 bg-slate-800/50">
                    {totalSelected > 0 && (
                        <div className="flex flex-wrap gap-1 pb-2 border-b border-slate-700">
                            <span className="text-xs text-slate-400 mr-1 leading-6">Selected:</span>
                            {selectedMorphs.map(m => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => toggleMorph(m)}
                                    className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full hover:bg-red-600 transition-colors"
                                    title="Click to remove"
                                >
                                    {m} ✕
                                </button>
                            ))}
                        </div>
                    )}

                    {Object.entries(MORPH_CATEGORIES).map(([category, { color, badge, morphs }]) => (
                        <div key={category}>
                            <div className={`text-xs font-semibold text-slate-300 mb-2 px-2 py-1 rounded border ${color}`}>
                                {category}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {morphs.map(morph => {
                                    const isSelected = selectedMorphs.includes(morph);
                                    return (
                                        <button
                                            key={morph}
                                            type="button"
                                            onClick={() => toggleMorph(morph)}
                                            className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                                                isSelected
                                                    ? `${badge} text-white border-transparent shadow-sm scale-105`
                                                    : 'bg-slate-700 text-slate-300 border-slate-600 hover:border-slate-400'
                                            }`}
                                        >
                                            {morph}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    <div className="flex justify-end pt-1">
                        <Button type="button" size="sm" variant="ghost" className="text-slate-400 hover:text-slate-200" onClick={() => setIsOpen(false)}>
                            Done
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export { MORPH_CATEGORIES };