import { useState, useEffect } from 'react';
import { Gecko } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { Dna, Loader2, ArrowLeftRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import GeneticCalculator from '../components/breeding/GeneticCalculator';

export default function GeneticCalculatorTool() {
    const [geckos, setGeckos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sireId, setSireId] = useState('');
    const [damId, setDamId] = useState('');

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const user = await base44.auth.me();
                if (user) {
                    const data = await Gecko.filter({ created_by: user.email });
                    setGeckos(data.filter(g => !g.archived));
                }
            } catch (e) {
                console.error(e);
            }
            setIsLoading(false);
        };
        load();
    }, []);

    const males = geckos.filter(g => g.sex === 'Male');
    const females = geckos.filter(g => g.sex === 'Female');
    const unsexed = geckos.filter(g => g.sex === 'Unsexed');

    const allForSire = [...males, ...unsexed];
    const allForDam = [...females, ...unsexed];

    const sire = geckos.find(g => g.id === sireId) || null;
    const dam = geckos.find(g => g.id === damId) || null;

    const handleSwap = () => {
        const prevSire = sireId;
        const prevDam = damId;
        setSireId(prevDam);
        setDamId(prevSire);
    };

    return (
        <div className="p-4 md:p-8 bg-slate-950 min-h-screen">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl md:text-4xl font-bold text-slate-100 flex items-center gap-3">
                        <Dna className="w-8 h-8 md:w-10 md:h-10 text-purple-400" />
                        Genetic Calculator
                    </h1>
                    <p className="text-slate-400 mt-2 text-sm md:text-base">
                        Select any two geckos from your collection to calculate potential offspring genetics.
                    </p>
                </div>

                {isLoading ? (
                    <div className="text-center py-20">
                        <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto" />
                    </div>
                ) : (
                    <>
                        {/* Selector row */}
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 mb-6">
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
                                {/* Sire selector */}
                                <div className="space-y-2">
                                    <Label className="text-blue-400 font-semibold">♂ Parent A (Sire)</Label>
                                    <Select value={sireId} onValueChange={setSireId}>
                                        <SelectTrigger className="bg-slate-800 border-blue-700 text-slate-100">
                                            <SelectValue placeholder="Select gecko..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                            {allForSire.map(g => (
                                                <SelectItem key={g.id} value={g.id}>
                                                    {g.name}{g.gecko_id_code ? ` (${g.gecko_id_code})` : ''} — {g.sex}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {sire && (
                                        <div className="flex items-center gap-2 mt-1">
                                            {sire.image_urls?.[0] && (
                                                <img src={sire.image_urls[0]} alt={sire.name} className="w-10 h-10 rounded object-cover border border-blue-700" />
                                            )}
                                            <div>
                                                <p className="text-xs text-slate-300 font-medium">{sire.name}</p>
                                                <p className="text-xs text-slate-500">{(sire.morph_tags || []).length} morph tags</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Swap button */}
                                <div className="flex justify-center pb-1">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={handleSwap}
                                        className="border-slate-600 hover:bg-slate-700 rounded-full"
                                        title="Swap parents"
                                    >
                                        <ArrowLeftRight className="w-4 h-4" />
                                    </Button>
                                </div>

                                {/* Dam selector */}
                                <div className="space-y-2">
                                    <Label className="text-pink-400 font-semibold">♀ Parent B (Dam)</Label>
                                    <Select value={damId} onValueChange={setDamId}>
                                        <SelectTrigger className="bg-slate-800 border-pink-700 text-slate-100">
                                            <SelectValue placeholder="Select gecko..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                            {allForDam.map(g => (
                                                <SelectItem key={g.id} value={g.id}>
                                                    {g.name}{g.gecko_id_code ? ` (${g.gecko_id_code})` : ''} — {g.sex}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {dam && (
                                        <div className="flex items-center gap-2 mt-1">
                                            {dam.image_urls?.[0] && (
                                                <img src={dam.image_urls[0]} alt={dam.name} className="w-10 h-10 rounded object-cover border border-pink-700" />
                                            )}
                                            <div>
                                                <p className="text-xs text-slate-300 font-medium">{dam.name}</p>
                                                <p className="text-xs text-slate-500">{(dam.morph_tags || []).length} morph tags</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Calculator results */}
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
                            <GeneticCalculator sire={sire} dam={dam} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}