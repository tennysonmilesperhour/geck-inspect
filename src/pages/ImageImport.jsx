import React, { useState, useEffect, Suspense } from 'react';
import { User, Gecko, BreedingPlan, Egg } from '@/entities/all';
import { canUseFeature } from '@/components/subscription/PlanLimitChecker';
import { supabase } from '@/lib/supabaseClient';
import { uploadFile } from '@/lib/uploadFile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Camera, Loader2, Check, X, Lock, ArrowRight, ImagePlus } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { todayLocalISO } from '@/lib/dateUtils';

const LoginPortal = React.lazy(() => import('@/components/auth/LoginPortal'));

const INCLUDED_IMPORTS = 25;

export default function ImageImport() {
    const [user, setUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [hasAccess, setHasAccess] = useState(false);

    const [mode, setMode] = useState('geckos');
    const [images, setImages] = useState([]);
    const [uploading, setUploading] = useState(false);

    const [step, setStep] = useState('upload'); // upload | processing | review | importing | done
    const [extractedRecords, setExtractedRecords] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [processError, setProcessError] = useState(null);

    const [importResults, setImportResults] = useState(null);
    const [importing, setImporting] = useState(false);

    const [geckos, setGeckos] = useState([]);
    const [breedingPlans, setBreedingPlans] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const currentUser = await User.me();
                setUser(currentUser);
                setAuthChecked(true);
                if (currentUser) {
                    setHasAccess(canUseFeature(currentUser, 'image_import'));
                    const [g, bp] = await Promise.all([
                        Gecko.filter({ created_by: currentUser.email }),
                        BreedingPlan.filter({ created_by: currentUser.email }),
                    ]);
                    setGeckos(g);
                    setBreedingPlans(bp);
                }
            } catch (e) {
                console.error(e);
                setAuthChecked(true);
            }
        })();
    }, []);

    if (!authChecked) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><LoadingSpinner /></div>;
    if (authChecked && !user) return <Suspense fallback={<LoadingSpinner />}><LoginPortal requiredFeature="AI Image Import" /></Suspense>;

    if (!hasAccess) {
        return (
            <div className="min-h-screen bg-slate-950 p-4 md:p-8">
                <div className="max-w-2xl mx-auto text-center py-20">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mx-auto mb-6">
                        <Lock className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-100 mb-3">AI Image Import</h1>
                    <p className="text-slate-400 mb-6">
                        Snap photos of notecards, screenshots, or records and let AI extract your gecko data automatically.
                        This feature is available on the Enterprise plan.
                    </p>
                    <Button asChild className="bg-gradient-to-r from-emerald-600 to-teal-600">
                        <a href="/Membership">View Plans <ArrowRight className="w-4 h-4 ml-2" /></a>
                    </Button>
                </div>
            </div>
        );
    }

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        setUploading(true);
        try {
            const uploaded = [];
            for (const file of files.slice(0, 20 - images.length)) {
                const { file_url } = await uploadFile({ file, folder: 'image-import' });
                uploaded.push({ url: file_url, name: file.name });
            }
            setImages(prev => [...prev, ...uploaded]);
        } catch (err) {
            console.error('Upload failed:', err);
        }
        setUploading(false);
    };

    const removeImage = (idx) => {
        setImages(prev => prev.filter((_, i) => i !== idx));
    };

    const handleProcess = async () => {
        if (images.length === 0) return;
        setProcessing(true);
        setProcessError(null);
        setStep('processing');

        try {
            const batches = [];
            for (let i = 0; i < images.length; i += 10) {
                batches.push(images.slice(i, i + 10).map(img => img.url));
            }

            let allRecords = [];
            for (const batch of batches) {
                const { data, error } = await supabase.functions.invoke('recognize-import-data', {
                    body: { imageUrls: batch, mode },
                });
                if (error) throw new Error(error.message || 'Edge function error');
                if (data?.error) throw new Error(data.error);
                if (data?.records) allRecords = [...allRecords, ...data.records];
            }

            setExtractedRecords(allRecords.map((r, i) => ({ ...r, _id: i, _selected: true })));
            setStep('review');
        } catch (err) {
            setProcessError(err.message);
            setStep('upload');
        }
        setProcessing(false);
    };

    const toggleRecord = (id) => {
        setExtractedRecords(prev => prev.map(r => r._id === id ? { ...r, _selected: !r._selected } : r));
    };

    const updateRecord = (id, field, value) => {
        setExtractedRecords(prev => prev.map(r => r._id === id ? { ...r, [field]: value } : r));
    };

    const handleImport = async () => {
        const selected = extractedRecords.filter(r => r._selected);
        if (selected.length === 0) return;
        setImporting(true);
        setStep('importing');

        const results = { created: 0, errors: [] };

        for (const record of selected) {
            try {
                if (mode === 'geckos') {
                    await Gecko.create({
                        name: record.name || 'Imported Gecko',
                        gecko_id_code: record.gecko_id_code || '',
                        sex: record.sex || 'Unsexed',
                        species: record.species || 'Crested Gecko',
                        hatch_date: record.hatch_date || '',
                        morphs_traits: record.morphs_traits || '',
                        weight_grams: record.weight_grams || undefined,
                        status: record.status || 'Pet',
                        sire_name: record.sire_name || '',
                        dam_name: record.dam_name || '',
                        asking_price: record.asking_price || undefined,
                        notes: [record.breeder_name ? `Breeder: ${record.breeder_name}` : '', record.notes || ''].filter(Boolean).join('\n'),
                        image_urls: [],
                    });
                } else if (mode === 'breeding') {
                    const sire = geckos.find(g =>
                        (record.sire_id_code && g.gecko_id_code === record.sire_id_code) ||
                        (record.sire_name && g.name?.toLowerCase() === record.sire_name.toLowerCase())
                    );
                    const dam = geckos.find(g =>
                        (record.dam_id_code && g.gecko_id_code === record.dam_id_code) ||
                        (record.dam_name && g.name?.toLowerCase() === record.dam_name.toLowerCase())
                    );
                    await BreedingPlan.create({
                        sire_id: sire?.id || '',
                        dam_id: dam?.id || '',
                        pairing_date: record.pairing_date || todayLocalISO(),
                        breeding_id: record.breeding_id || '',
                        breeding_season: record.breeding_season || '',
                        status: record.status || 'Planned',
                        notes: record.notes || '',
                    });
                } else if (mode === 'eggs') {
                    let plan = breedingPlans.find(bp => {
                        const sire = geckos.find(g => g.id === bp.sire_id);
                        const dam = geckos.find(g => g.id === bp.dam_id);
                        return (
                            (record.sire_name && sire?.name?.toLowerCase() === record.sire_name.toLowerCase()) &&
                            (record.dam_name && dam?.name?.toLowerCase() === record.dam_name.toLowerCase())
                        );
                    });

                    const eggCount = record.egg_count || 1;
                    for (let i = 0; i < eggCount; i++) {
                        await Egg.create({
                            breeding_plan_id: plan?.id || '',
                            lay_date: record.lay_date || todayLocalISO(),
                            hatch_date_expected: record.hatch_date_expected || '',
                            hatch_date_actual: record.hatch_date_actual || '',
                            status: record.status || 'Incubating',
                            grade: record.grade || '',
                        });
                    }
                }
                results.created++;
            } catch (err) {
                results.errors.push(`Record "${record.name || record.sire_name || 'unknown'}": ${err.message}`);
            }
        }

        setImportResults(results);
        setStep('done');
        setImporting(false);
    };

    const resetAll = () => {
        setImages([]);
        setExtractedRecords([]);
        setImportResults(null);
        setProcessError(null);
        setStep('upload');
    };

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                            <Camera className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-slate-100">AI Image Import</h1>
                    </div>
                    <p className="text-slate-400">Upload photos of notecards, screenshots, or records — AI extracts the data for you.</p>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-8">
                    {['upload', 'processing', 'review', 'done'].map((s, i) => (
                        <React.Fragment key={s}>
                            {i > 0 && <div className={`flex-1 h-0.5 ${['processing','review','importing','done'].indexOf(step) >= i ? 'bg-emerald-500' : 'bg-slate-700'}`} />}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                step === s || (['importing'].includes(step) && s === 'review')
                                    ? 'bg-emerald-500 text-white'
                                    : ['processing','review','importing','done'].indexOf(step) > ['upload','processing','review','done'].indexOf(s)
                                        ? 'bg-emerald-700 text-emerald-200'
                                        : 'bg-slate-700 text-slate-400'
                            }`}>
                                {i + 1}
                            </div>
                        </React.Fragment>
                    ))}
                </div>

                {/* STEP 1: Upload */}
                {step === 'upload' && (
                    <div className="space-y-6">
                        <Card className="bg-slate-900 border-slate-700">
                            <CardContent className="p-6 space-y-4">
                                <div>
                                    <Label className="text-slate-300">Import Mode</Label>
                                    <Select value={mode} onValueChange={setMode}>
                                        <SelectTrigger className="w-full sm:w-64 bg-slate-800 border-slate-600 mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-600">
                                            <SelectItem value="geckos">Gecko Records</SelectItem>
                                            <SelectItem value="breeding">Breeding Pairs</SelectItem>
                                            <SelectItem value="eggs">Eggs / Clutches</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label className="text-slate-300 mb-2 block">Upload Images (up to 20)</Label>
                                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-600 rounded-lg p-8 cursor-pointer hover:border-emerald-500 transition-colors">
                                        <ImagePlus className="w-12 h-12 text-slate-500 mb-3" />
                                        <span className="text-slate-400 text-sm">Click to select images or drag and drop</span>
                                        <span className="text-slate-500 text-xs mt-1">JPEG, PNG, WebP — max 10MB each</span>
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            multiple
                                            className="hidden"
                                            onChange={handleFileSelect}
                                            disabled={uploading}
                                        />
                                    </label>
                                </div>

                                {uploading && (
                                    <div className="flex items-center gap-2 text-emerald-400">
                                        <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                                    </div>
                                )}

                                {images.length > 0 && (
                                    <div>
                                        <p className="text-sm text-slate-300 mb-2">{images.length} image{images.length !== 1 ? 's' : ''} ready</p>
                                        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
                                            {images.map((img, i) => (
                                                <div key={i} className="relative group">
                                                    <img src={img.url} alt={img.name} className="w-full aspect-square object-cover rounded-lg border border-slate-700" />
                                                    <button
                                                        onClick={() => removeImage(i)}
                                                        className="absolute top-1 right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-3 h-3 text-white" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {processError && (
                                    <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">
                                        {processError}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Button
                            onClick={handleProcess}
                            disabled={images.length === 0 || uploading}
                            className="w-full sm:w-auto bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                            size="lg"
                        >
                            <Camera className="w-5 h-5 mr-2" />
                            Extract Data from {images.length} Image{images.length !== 1 ? 's' : ''}
                        </Button>
                    </div>
                )}

                {/* STEP 2: Processing */}
                {step === 'processing' && (
                    <Card className="bg-slate-900 border-slate-700">
                        <CardContent className="p-12 text-center">
                            <Loader2 className="w-16 h-16 animate-spin text-violet-400 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-slate-100 mb-2">Analyzing Images...</h2>
                            <p className="text-slate-400">AI is reading your {images.length} image{images.length !== 1 ? 's' : ''} and extracting {mode} data.</p>
                        </CardContent>
                    </Card>
                )}

                {/* STEP 3: Review */}
                {step === 'review' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-100">
                                Review Extracted Data ({extractedRecords.filter(r => r._selected).length} of {extractedRecords.length} selected)
                            </h2>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setStep('upload')} className="border-slate-600">Back</Button>
                                <Button
                                    onClick={handleImport}
                                    disabled={extractedRecords.filter(r => r._selected).length === 0}
                                    className="bg-gradient-to-r from-emerald-600 to-teal-600"
                                >
                                    Import {extractedRecords.filter(r => r._selected).length} Records
                                </Button>
                            </div>
                        </div>

                        {extractedRecords.map((record) => (
                            <Card key={record._id} className={`bg-slate-900 border-slate-700 ${!record._selected ? 'opacity-50' : ''}`}>
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                        <button
                                            onClick={() => toggleRecord(record._id)}
                                            className={`mt-1 w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center ${record._selected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-500'}`}
                                        >
                                            {record._selected && <Check className="w-3 h-3 text-white" />}
                                        </button>
                                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                            {mode === 'geckos' && (
                                                <>
                                                    <EditField label="Name" value={record.name} onChange={v => updateRecord(record._id, 'name', v)} />
                                                    <EditField label="ID Code" value={record.gecko_id_code} onChange={v => updateRecord(record._id, 'gecko_id_code', v)} />
                                                    <div>
                                                        <Label className="text-xs text-slate-400">Sex</Label>
                                                        <Select value={record.sex || 'Unsexed'} onValueChange={v => updateRecord(record._id, 'sex', v)}>
                                                            <SelectTrigger className="h-8 text-xs bg-slate-800 border-slate-600"><SelectValue /></SelectTrigger>
                                                            <SelectContent className="bg-slate-800 border-slate-600">
                                                                <SelectItem value="Male">Male</SelectItem>
                                                                <SelectItem value="Female">Female</SelectItem>
                                                                <SelectItem value="Unsexed">Unsexed</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <EditField label="Species" value={record.species} onChange={v => updateRecord(record._id, 'species', v)} />
                                                    <EditField label="Hatch Date" value={record.hatch_date} onChange={v => updateRecord(record._id, 'hatch_date', v)} type="date" />
                                                    <EditField label="Morphs/Traits" value={record.morphs_traits} onChange={v => updateRecord(record._id, 'morphs_traits', v)} />
                                                    <EditField label="Weight (g)" value={record.weight_grams} onChange={v => updateRecord(record._id, 'weight_grams', v ? Number(v) : null)} type="number" />
                                                    <EditField label="Sire" value={record.sire_name} onChange={v => updateRecord(record._id, 'sire_name', v)} />
                                                    <EditField label="Dam" value={record.dam_name} onChange={v => updateRecord(record._id, 'dam_name', v)} />
                                                    <EditField label="Notes" value={record.notes} onChange={v => updateRecord(record._id, 'notes', v)} />
                                                </>
                                            )}
                                            {mode === 'breeding' && (
                                                <>
                                                    <EditField label="Sire Name" value={record.sire_name} onChange={v => updateRecord(record._id, 'sire_name', v)} />
                                                    <EditField label="Dam Name" value={record.dam_name} onChange={v => updateRecord(record._id, 'dam_name', v)} />
                                                    <EditField label="Pairing Date" value={record.pairing_date} onChange={v => updateRecord(record._id, 'pairing_date', v)} type="date" />
                                                    <EditField label="Breeding ID" value={record.breeding_id} onChange={v => updateRecord(record._id, 'breeding_id', v)} />
                                                    <EditField label="Season" value={record.breeding_season} onChange={v => updateRecord(record._id, 'breeding_season', v)} />
                                                    <EditField label="Notes" value={record.notes} onChange={v => updateRecord(record._id, 'notes', v)} />
                                                </>
                                            )}
                                            {mode === 'eggs' && (
                                                <>
                                                    <EditField label="Sire" value={record.sire_name} onChange={v => updateRecord(record._id, 'sire_name', v)} />
                                                    <EditField label="Dam" value={record.dam_name} onChange={v => updateRecord(record._id, 'dam_name', v)} />
                                                    <EditField label="Lay Date" value={record.lay_date} onChange={v => updateRecord(record._id, 'lay_date', v)} type="date" />
                                                    <EditField label="Expected Hatch" value={record.hatch_date_expected} onChange={v => updateRecord(record._id, 'hatch_date_expected', v)} type="date" />
                                                    <div>
                                                        <Label className="text-xs text-slate-400">Status</Label>
                                                        <Select value={record.status || 'Incubating'} onValueChange={v => updateRecord(record._id, 'status', v)}>
                                                            <SelectTrigger className="h-8 text-xs bg-slate-800 border-slate-600"><SelectValue /></SelectTrigger>
                                                            <SelectContent className="bg-slate-800 border-slate-600">
                                                                <SelectItem value="Incubating">Incubating</SelectItem>
                                                                <SelectItem value="Hatched">Hatched</SelectItem>
                                                                <SelectItem value="Slug">Slug</SelectItem>
                                                                <SelectItem value="Infertile">Infertile</SelectItem>
                                                                <SelectItem value="Stillbirth">Stillbirth</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <EditField label="Egg Count" value={record.egg_count} onChange={v => updateRecord(record._id, 'egg_count', v ? Number(v) : 1)} type="number" />
                                                    <EditField label="Notes" value={record.notes} onChange={v => updateRecord(record._id, 'notes', v)} />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        {extractedRecords.length === 0 && (
                            <Card className="bg-slate-900 border-slate-700">
                                <CardContent className="p-8 text-center">
                                    <p className="text-slate-400">No records were extracted. Try uploading clearer images or a different mode.</p>
                                    <Button variant="outline" onClick={() => setStep('upload')} className="mt-4 border-slate-600">Try Again</Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}

                {/* STEP 3b: Importing */}
                {step === 'importing' && (
                    <Card className="bg-slate-900 border-slate-700">
                        <CardContent className="p-12 text-center">
                            <Loader2 className="w-16 h-16 animate-spin text-emerald-400 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-slate-100 mb-2">Importing Records...</h2>
                            <p className="text-slate-400">Creating your {mode} records now.</p>
                        </CardContent>
                    </Card>
                )}

                {/* STEP 4: Done */}
                {step === 'done' && importResults && (
                    <Card className="bg-slate-900 border-slate-700">
                        <CardContent className="p-8 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-600 flex items-center justify-center mx-auto">
                                <Check className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-100">Import Complete</h2>
                            <p className="text-emerald-400 text-lg">{importResults.created} record{importResults.created !== 1 ? 's' : ''} created</p>
                            {importResults.errors.length > 0 && (
                                <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-left text-sm">
                                    <p className="font-semibold text-red-300 mb-2">{importResults.errors.length} error{importResults.errors.length !== 1 ? 's' : ''}:</p>
                                    {importResults.errors.map((e, i) => <p key={i} className="text-red-400">{e}</p>)}
                                </div>
                            )}
                            <div className="flex gap-3 justify-center pt-4">
                                <Button variant="outline" onClick={resetAll} className="border-slate-600">Import More</Button>
                                <Button asChild className="bg-gradient-to-r from-emerald-600 to-teal-600">
                                    <a href={mode === 'geckos' ? '/MyGeckos' : mode === 'breeding' ? '/Breeding' : '/Breeding'}>
                                        View {mode === 'geckos' ? 'Collection' : 'Breeding'}
                                    </a>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}

function EditField({ label, value, onChange, type = 'text' }) {
    return (
        <div>
            <Label className="text-xs text-slate-400">{label}</Label>
            <Input
                type={type}
                value={value ?? ''}
                onChange={e => onChange(e.target.value)}
                className="h-8 text-xs bg-slate-800 border-slate-600"
            />
        </div>
    );
}
