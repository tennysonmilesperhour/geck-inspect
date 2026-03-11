import React from 'react';
import { X, Dna } from 'lucide-react';
import GeneticCalculator from './GeneticCalculator';

export default function GeneticsModal({ isOpen, onClose, sire, dam }) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
            onClick={onClose}
        >
            <div
                className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header — always visible, close button never obscured */}
                <div className="flex items-center justify-between p-5 border-b border-slate-700 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Dna className="w-5 h-5 text-purple-400" />
                        <div>
                            <h2 className="text-slate-100 font-semibold text-lg">
                                Genetic Calculator
                            </h2>
                            {sire && dam && (
                                <p className="text-slate-400 text-sm">
                                    {sire.name} × {dam.name}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg p-2 transition-colors flex-shrink-0"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="overflow-y-auto flex-1 p-5">
                    <p className="text-slate-400 text-sm mb-4">
                        Estimated offspring trait probabilities based on each parent's Morph ID tags.
                    </p>
                    <GeneticCalculator sire={sire} dam={dam} />
                </div>
            </div>
        </div>
    );
}