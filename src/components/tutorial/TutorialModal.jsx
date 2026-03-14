import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Zap } from 'lucide-react';

const STEPS = [
    {
        title: "Welcome to Geck Inspect! 🦎",
        description: "Your all-in-one platform for managing your crested gecko collection. Let's take a quick tour of what you can do.",
        icon: "🦎",
        color: "from-emerald-600 to-green-600"
    },
    {
        title: "My Geckos",
        description: "Add and manage your entire gecko collection. Track each gecko's profile, weight history, morph tags, status, and more. Use the card or list view to browse your collection.",
        icon: "🐾",
        color: "from-teal-600 to-emerald-600"
    },
    {
        title: "Breeding Management",
        description: "Create breeding pairs (plans), track egg lays, record copulation events, and watch as eggs hatch into new geckos automatically added to your collection.",
        icon: "🥚",
        color: "from-green-600 to-teal-600"
    },
    {
        title: "Lineage Tracker",
        description: "Visualize your gecko family trees going back multiple generations. Add placeholder ancestors for geckos you purchased from other breeders.",
        icon: "🌳",
        color: "from-emerald-700 to-green-700"
    },
    {
        title: "Morph ID (AI Tool)",
        description: "Upload a photo of any crested gecko and our AI will identify its morphs and traits. Great for identifying new acquisitions or verifying your own geckos.",
        icon: "🔍",
        color: "from-blue-600 to-emerald-600"
    },
    {
        title: "Genetics Calculator",
        description: "Select any two geckos and see predicted offspring outcomes based on their morph tags. Available inside the Breeding page under the Genetics tab.",
        icon: "🧬",
        color: "from-purple-600 to-blue-600"
    },
    {
        title: "AI Breeder Consultant",
        description: "Ask our AI assistant any question about crested gecko care, breeding strategies, morph genetics, pricing, and more — powered by real gecko knowledge.",
        icon: "🤖",
        color: "from-indigo-600 to-purple-600"
    },
    {
        title: "Morph Guide & Care Guide",
        description: "Browse our comprehensive morph reference library and care guides. Learn to identify morphs and get best-practice care information for your geckos.",
        icon: "📚",
        color: "from-amber-600 to-orange-600"
    },
    {
        title: "You're all set! 🎉",
        description: "Explore the app at your own pace. You can relaunch this tutorial anytime from the Tools section in the sidebar. Happy breeding!",
        icon: "🎉",
        color: "from-emerald-600 to-green-500"
    }
];

export default function TutorialModal({ isOpen, onClose }) {
    const [step, setStep] = useState(0);

    const handleClose = () => {
        localStorage.setItem('tutorial_completed', 'true');
        setStep(0);
        onClose();
    };

    const current = STEPS[step];
    const isLast = step === STEPS.length - 1;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-md p-0 overflow-hidden">
                {/* Progress bar */}
                <div className="w-full h-1 bg-slate-700">
                    <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                    />
                </div>

                {/* Header gradient */}
                <div className={`bg-gradient-to-r ${current.color} p-8 text-center`}>
                    <div className="text-6xl mb-3">{current.icon}</div>
                    <h2 className="text-xl font-bold text-white">{current.title}</h2>
                </div>

                {/* Body */}
                <div className="p-6">
                    <p className="text-slate-300 text-center leading-relaxed">{current.description}</p>

                    <div className="flex items-center justify-between mt-6 gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setStep(s => s - 1)}
                            disabled={step === 0}
                            className="border-slate-600 text-slate-400"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>

                        {/* Step dots */}
                        <div className="flex gap-1.5">
                            {STEPS.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setStep(i)}
                                    className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-emerald-400' : 'bg-slate-600'}`}
                                />
                            ))}
                        </div>

                        {isLast ? (
                            <Button
                                size="sm"
                                onClick={handleClose}
                                className="bg-emerald-600 hover:bg-emerald-700 px-4"
                            >
                                <Zap className="w-4 h-4 mr-1" /> Done
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={() => setStep(s => s + 1)}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                Next <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        )}
                    </div>

                    <button
                        onClick={handleClose}
                        className="w-full mt-3 text-xs text-slate-500 hover:text-slate-400 transition-colors"
                    >
                        Skip tutorial
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}