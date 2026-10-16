import { X, Dna } from 'lucide-react';
import GeneticCalculator from './GeneticCalculator';
import useModalOverlay from '@/hooks/useModalOverlay';

export default function GeneticsModal({ isOpen, onClose, sire, dam }) {
    // Called before the early return (hooks must run on every render); the
    // open flag makes it set up again each time the calculator opens.
    const overlay = useModalOverlay(onClose, isOpen);
    if (!isOpen) return null;

    return (
        <div
            {...overlay}
            aria-label="Genetic Calculator"
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
            onClick={onClose}
        >
            <div
                className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
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
                        className="text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg p-2 touch:min-h-11 touch:min-w-11 touch:inline-flex touch:items-center touch:justify-center transition-colors flex-shrink-0"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-5">
                    <p className="text-slate-400 text-sm mb-4">
                        Offspring trait probabilities from Punnett-square math across independent loci. Lethal
                        (Lilly × Lilly) and health-risk (Cappuccino × Cappuccino, and Highway × Highway on breeder
                        reports) pairings are flagged automatically.
                    </p>
                    <GeneticCalculator sire={sire} dam={dam} />
                </div>
            </div>
        </div>
    );
}