import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Gecko, UserActivity, WeightRecord, FeedingGroup } from '@/entities/all';
import { UploadFile } from '@/integrations/Core';
import { notifyFollowersNewGecko } from '@/components/notifications/NotificationService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { format } from "date-fns";
import { Upload, X, Trash2, DollarSign, Award, GitBranch, Loader2 } from "lucide-react";
import { Switch } from '@/components/ui/switch';
import {
  generateOwnershipCertificatePDF,
  generateLineageCertificatePDF,
} from '@/lib/certificateUtils';
import MorphIDSelector from './MorphIDSelector';
// Extracted helpers / constants / sub-components — keeps this file focused
// on the orchestration logic instead of static data and pure UI pieces.
import { MONTHS, GECKO_SPECIES, INITIAL_FORM_DATA, DEFAULT_GECKO_IMAGE } from './form/constants';
import { generateNextGeckoId } from './form/helpers';
import ImageCropDialog from './form/ImageCropDialog';
import ParentAutocomplete from './form/ParentAutocomplete';

// Back-compat alias so the rest of this file doesn't need to change
const initialFormData = INITIAL_FORM_DATA;

export default function GeckoForm({ gecko, userGeckos, currentUser, onSubmit, onCancel, isHatching = false, onDelete, breedingPlan = null, feedingGroups: feedingGroupsProp = null }) {
    const isArchived = gecko?.archived;
    const [formData, setFormData] = useState(initialFormData);
    const [isSaving, setIsSaving] = useState(false);
    // Change sire/dam to use text inputs instead of just IDs
    const [sireInput, setSireInput] = useState('');
    const [damInput, setDamInput] = useState('');
    const [sireId, setSireId] = useState('');
    const [damId, setDamId] = useState('');
    
    // New state for individual date parts
    const [hatchYear, setHatchYear] = useState('');
    const [hatchMonth, setHatchMonth] = useState('');
    const [hatchDay, setHatchDay] = useState('');

    // Image cropping states
    const [cropDialogOpen, setCropDialogOpen] = useState(false);
    const [currentImage, setCurrentImage] = useState(null);
    const [cropData, setCropData] = useState({}); // Local state for crop data before saving
    
    // New state for "For Sale" toggle
    const [isForSale, setIsForSale] = useState(false);
    
    // New states for certificate generation
    const [isGeneratingCert, setIsGeneratingCert] = useState(false);
    const [certType, setCertType] = useState('');
    const [feedingGroups, setFeedingGroups] = useState([]);
    // sire/dam suggestion visibility + refs now live inside ParentAutocomplete

    useEffect(() => {
        if (feedingGroupsProp) {
            setFeedingGroups(feedingGroupsProp);
        } else {
            FeedingGroup.list().then(setFeedingGroups).catch(() => {});
        }
    }, [feedingGroupsProp]);

    const handleChange = useCallback((field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    // Effect 1: Initialize form data when gecko changes or new gecko is created
    useEffect(() => {
        if (gecko) {
            // We are editing an existing gecko or initializing a new hatched one (with pre-filled parents).
            const formDataToSet = {
                ...initialFormData, // Start with default values
                ...gecko,     // Overlay gecko data
                image_urls: gecko.image_urls || [], // Ensure image_urls is always an array
                // Ensure number fields are string for input type="number"
                weight_grams: gecko.weight_grams !== undefined && gecko.weight_grams !== null ? gecko.weight_grams.toString() : '',
                asking_price: gecko.asking_price !== undefined && gecko.asking_price !== null ? gecko.asking_price.toString() : '',
                // Set defaults for other fields if null/undefined
                name: gecko.name || '',
                gecko_id_code: gecko.gecko_id_code || '',
                hatch_date: gecko.hatch_date ? new Date(gecko.hatch_date) : null,
                sex: gecko.sex || 'Unsexed',
                morphs_traits: gecko.morphs_traits || '',
                notes: gecko.notes || '',
                status: gecko.status || 'Pet',
                image_crop_data: gecko.image_crop_data || {}
            };

            // For new hatched geckos, auto-populate name and parents
            if (isHatching && breedingPlan) {
                const sire = userGeckos.find(g => g.id === breedingPlan.sire_id);
                const dam = userGeckos.find(g => g.id === breedingPlan.dam_id);
                
                // Generate name based on parents
                const siblings = userGeckos.filter(g => 
                    g.sire_id === breedingPlan.sire_id && g.dam_id === breedingPlan.dam_id
                );
                const hatchNumber = siblings.length + 1; // Correctly count existing siblings to get the next number
                
                const autoName = `${sire?.name || 'Sire'} x ${dam?.name || 'Dam'} #${hatchNumber}`;
                
                formDataToSet.name = autoName;
                formDataToSet.sire_id = breedingPlan.sire_id;
                formDataToSet.dam_id = breedingPlan.dam_id;
            }
            
            setFormData(formDataToSet);
            setCropData(gecko.image_crop_data || {}); // Set local crop data state

            // Also, parse the date parts for the UI inputs.
            const date = gecko.hatch_date ? new Date(gecko.hatch_date) : null;
            if (date && !isNaN(date.getTime())) {
                setHatchYear(date.getFullYear().toString());
                setHatchMonth((date.getMonth() + 1).toString());
                setHatchDay(date.getDate().toString());
            } else {
                setHatchYear('');
                setHatchMonth('');
                setHatchDay('');
            }
            setIsForSale(gecko.status === 'For Sale');

            // Handle sire/dam display names
            const sire = userGeckos.find(g => g.id === gecko.sire_id);
            const dam = userGeckos.find(g => g.id === gecko.dam_id);
            
            setSireInput(sire ? `${sire.name} (${sire.gecko_id_code || 'No ID'})` : gecko.sire_name || '');
            setDamInput(dam ? `${dam.name} (${dam.gecko_id_code || 'No ID'})` : gecko.dam_name || '');
            setSireId(gecko.sire_id || '');
            setDamId(gecko.dam_id || '');

        } else {
            // We are creating a new gecko from scratch. Generate ID and set initial state.
            const generateIdAndSet = async () => {
                const newId = await generateNextGeckoId(currentUser, userGeckos);
                setFormData({
                    ...initialFormData,
                    gecko_id_code: newId
                });
            };
            generateIdAndSet();
            setIsForSale(false); // New geckos are not for sale by default
            setHatchYear('');
            setHatchMonth('');
            setHatchDay('');
            setCropData({}); // Reset crop data for new gecko
            setSireInput('');
            setDamInput('');
            setSireId('');
            setDamId('');
        }
    }, [gecko, currentUser, userGeckos, isHatching, breedingPlan]); // Dependencies for initial setup and ID generation for new founder geckos.

    // Effect 2: Generate gecko_id_code specifically for NEW hatched geckos (if not already set)
    useEffect(() => {
        const generateIdForHatched = async () => {
            // Only generate if gecko_id_code is currently empty AND it's a new hatched gecko and a breeding plan is available
            if (isHatching && gecko && !gecko.id && !formData.gecko_id_code && breedingPlan) {
                const sire = userGeckos.find(g => g.id === breedingPlan.sire_id);
                const dam = userGeckos.find(g => g.id === breedingPlan.dam_id);
                const newId = await generateNextGeckoId(currentUser, userGeckos, sire, dam);
                setFormData(prev => ({ ...prev, gecko_id_code: newId }));
            }
        };
        generateIdForHatched();
    }, [gecko, currentUser, userGeckos, isHatching, formData.gecko_id_code, breedingPlan]);

    // Effect 3: Construct date from parts
    useEffect(() => {
        if (hatchYear && hatchYear.length === 4 && hatchMonth && hatchDay) {
            // Use T00:00:00 to avoid timezone issues converting the date string
            const dateStr = `${hatchYear}-${String(hatchMonth).padStart(2, '0')}-${String(hatchDay).padStart(2, '0')}T00:00:00`;
            const newDate = new Date(dateStr);

            // Robust validation
            const isValidDate = !isNaN(newDate.getTime()) && 
                                newDate.getFullYear() === parseInt(hatchYear, 10) &&
                                newDate.getMonth() + 1 === parseInt(hatchMonth, 10) &&
                                newDate.getDate() === parseInt(hatchDay, 10);

            if (isValidDate) {
                handleChange('hatch_date', newDate);
            } else {
                handleChange('hatch_date', null);
            }
        } else {
            handleChange('hatch_date', null);
        }
    }, [hatchYear, hatchMonth, hatchDay, handleChange]);

    const handleForSaleToggle = (checked) => {
        setIsForSale(checked);
        if (checked) {
            handleChange('status', 'For Sale');
        } else {
            // Revert to a default status if it was "For Sale"
            if (formData.status === 'For Sale') {
                handleChange('status', 'Pet'); // or whatever default you prefer
            }
        }
    };

    const handleSireInputChange = (value) => {
        setSireInput(value);
        // Only clear ID if user completely empties the input; otherwise keep ID until explicitly changed
        if (value === '') {
            setSireId('');
        } else {
            // Try to find matching gecko in user's collection
            const matchingGecko = userGeckos.find(g =>
                g.sex === 'Male' && (
                    `${g.name} (${g.gecko_id_code || 'No ID'})` === value ||
                    g.name.toLowerCase() === value.toLowerCase() ||
                    (g.gecko_id_code && g.gecko_id_code.toLowerCase() === value.toLowerCase())
                )
            );
            // Only update ID if a fresh match is found; otherwise leave current ID untouched
            if (matchingGecko) {
                setSireId(matchingGecko.id);
            }
        }
    };

    const handleDamInputChange = (value) => {
        setDamInput(value);
        // Only clear ID if user completely empties the input; otherwise keep ID until explicitly changed
        if (value === '') {
            setDamId('');
        } else {
            // Try to find matching gecko in user's collection
            const matchingGecko = userGeckos.find(g =>
                g.sex === 'Female' && (
                    `${g.name} (${g.gecko_id_code || 'No ID'})` === value ||
                    g.name.toLowerCase() === value.toLowerCase() ||
                    (g.gecko_id_code && g.gecko_id_code.toLowerCase() === value.toLowerCase())
                )
            );
            // Only update ID if a fresh match is found; otherwise leave current ID untouched
            if (matchingGecko) {
                setDamId(matchingGecko.id);
            }
        }
    };
    
    // Enhanced image upload with cropping capability
    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        setIsSaving(true);
        const urls = [...formData.image_urls];
        const newCropData = { ...cropData };

        try {
            for (const file of files) {
                const { file_url } = await UploadFile({ file });
                urls.push(file_url);
                // Initialize crop data for new image (centered by default)
                newCropData[file_url] = { x: 50, y: 50 };
            }
            setFormData(prev => ({ ...prev, image_urls: urls }));
            setCropData(newCropData);
        } catch (err) {
            console.error("Image upload failed", err);
        }
        
        setIsSaving(false);
    };

    const handleImageCrop = (imageUrl) => {
        setCurrentImage(imageUrl);
        setCropDialogOpen(true);
    };

    const saveCropData = (url, cropInfo) => {
        setCropData(prev => ({
            ...prev,
            [url]: cropInfo
        }));
        setCropDialogOpen(false);
    };

    const removeImage = (urlToRemove) => {
        setFormData(prev => ({ ...prev, image_urls: prev.image_urls.filter(url => url !== urlToRemove)}));
        setCropData(prev => {
            const newCropData = { ...prev };
            delete newCropData[urlToRemove];
            return newCropData;
        });
    }

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        
        try {
            // Construct the payload directly from the most recent form state.
            // Using `null` for empty parent fields for better database consistency.
            const dataToSave = {
                name: formData.name,
                gecko_id_code: formData.gecko_id_code,
                hatch_date: formData.hatch_date ? format(formData.hatch_date, 'yyyy-MM-dd') : null,
                sex: formData.sex,
                sire_id: sireId || null,
                dam_id: damId || null,
                sire_name: sireId ? null : sireInput,
                dam_name: damId ? null : damInput,
                morphs_traits: formData.morphs_traits,
                morph_tags: formData.morph_tags || [],
                feeding_group_id: formData.feeding_group_id || null,
                notes: formData.notes,
                status: formData.status,
                image_urls: formData.image_urls,
                asking_price: formData.asking_price !== '' && formData.asking_price !== null ? 
                             parseFloat(formData.asking_price) : null,
                image_crop_data: cropData,
                species: formData.species || 'Crested Gecko',
                is_gravid: formData.sex === 'Female' ? (formData.is_gravid || false) : false,
                gravid_since: formData.sex === 'Female' && formData.is_gravid ? (formData.gravid_since || null) : null,
                egg_drop_date: formData.sex === 'Female' && formData.is_gravid ? (formData.egg_drop_date || null) : null,
            };

            let savedGecko;
            const isNew = !gecko?.id || isHatching; // isHatching implies new even if gecko has some data
            if (isNew) {
                savedGecko = await Gecko.create(dataToSave);
                // Award points for new gecko
                // Using currentUser prop as it's already passed to the component
                if (currentUser) {
                    await UserActivity.create({
                        user_email: currentUser.email,
                        activity_type: 'new_gecko',
                        points: 5,
                        related_entity_id: savedGecko.id
                    });
                    
                    // Notify followers if gecko is public
                    if (savedGecko.is_public !== false) {
                        notifyFollowersNewGecko(savedGecko, currentUser.email, currentUser.full_name).catch(console.error);
                    }
                }
            } else {
                savedGecko = await Gecko.update(gecko.id, dataToSave);
            }

            // If a weight was provided, always create a WeightRecord (WeightRecord is source of truth)
             const weightValue = formData.weight_grams !== '' && formData.weight_grams !== null
                 ? parseFloat(formData.weight_grams)
                 : null;
             if (weightValue !== null) {
                 await WeightRecord.create({
                     gecko_id: savedGecko.id,
                     weight_grams: weightValue,
                     record_date: new Date().toISOString().split('T')[0],
                 });
             }

             // Auto-assign feeding group by weight if weight exists and no group is assigned
             if (weightValue !== null && !savedGecko.feeding_group_id && feedingGroups.length > 0) {
                 const matchingGroup = feedingGroups.find(group => 
                     group.auto_weight_min_g !== null && 
                     group.auto_weight_max_g !== null &&
                     weightValue >= group.auto_weight_min_g && 
                     weightValue <= group.auto_weight_max_g
                 );
                 if (matchingGroup) {
                     await Gecko.update(savedGecko.id, { feeding_group_id: matchingGroup.id });
                     savedGecko = { ...savedGecko, feeding_group_id: matchingGroup.id };
                 }
             }
            
            if (onSubmit) {
                onSubmit(savedGecko, isNew);
            }
        } catch (error) {
            console.error('Failed to save gecko:', error);
        }
        setIsSaving(false);
    };

    const handleDeleteConfirm = () => {
        if (gecko && onDelete) {
            onDelete(gecko.id);
        }
    };
    
    const handleGenerateCertificate = async (type) => {
        if (!gecko || !gecko.id) return;

        setIsGeneratingCert(true);
        setCertType(type);

        try {
            // Resolve parents + grandparents from the in-memory userGeckos list
            // — no server round-trip. Falls back to null when not found.
            const getById = (id) => (id ? userGeckos.find((g) => g.id === id) : null);
            const sire = getById(gecko.sire_id);
            const dam  = getById(gecko.dam_id);
            const grandparents = {
                gsS: sire ? getById(sire.sire_id) : null,
                gdS: sire ? getById(sire.dam_id)  : null,
                gsD: dam  ? getById(dam.sire_id)  : null,
                gdD: dam  ? getById(dam.dam_id)   : null,
            };

            if (type === 'ownership') {
                generateOwnershipCertificatePDF(gecko, currentUser);
            } else {
                generateLineageCertificatePDF({
                    gecko,
                    sire,
                    dam,
                    grandparents,
                    owner: currentUser,
                });
            }
        } catch (error) {
            console.error('Failed to generate certificate:', error);
        } finally {
            setIsGeneratingCert(false);
            setCertType('');
        }
    };

    const getSaveButtonText = () => {
        if (isSaving) return 'Saving...';
        if (isHatching) return 'Record Hatchling';
        if (gecko?.id) return 'Update Gecko';
        return 'Add Gecko';
    };


    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={onCancel}></div>
            <Card className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-4xl h-[90vh] z-50 bg-slate-900 border-slate-700 flex flex-col">
                <CardHeader className="flex-shrink-0">
                    <CardTitle className="text-2xl text-slate-100">{gecko ? `Edit ${gecko.name}` : (isHatching ? 'Record New Hatchling' : 'Add New Gecko')}</CardTitle>
                    {isHatching && breedingPlan && (
                        <p className="text-slate-400 text-sm">
                            From pairing: {breedingPlan.sire?.name || 'N/A'} x {breedingPlan.dam?.name || 'N/A'}
                        </p>
                    )}
                </CardHeader>

                <form onSubmit={handleSave} className="flex-grow overflow-y-auto space-y-4 p-4">
                    {isArchived && (
                        <div className="space-y-4 mb-4">
                            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3">
                                <p className="text-sm text-yellow-200"><strong>This gecko is archived.</strong> Only the archive reason can be edited. Unarchive to make other changes.</p>
                            </div>
                            <div className="bg-slate-800 p-4 rounded-lg">
                                <p className="text-xs text-slate-400 mb-3">Archive reason:</p>
                                <div className="flex gap-2 flex-wrap">
                                    {[
                                        { value: 'death', label: 'Passed Away' },
                                        { value: 'sold', label: 'Sold' },
                                        { value: 'other', label: 'Other' },
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={async () => {
                                                await Gecko.update(gecko.id, { archive_reason: opt.value });
                                                if (onSubmit) onSubmit(gecko);
                                            }}
                                            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                                                gecko.archive_reason === opt.value
                                                    ? 'border-emerald-500 bg-emerald-900/40 text-emerald-300'
                                                    : 'border-slate-600 text-slate-400 hover:bg-slate-700 hover:border-slate-500'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                             <Label htmlFor="name">Name *</Label>
                             <Input id="name" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} required disabled={isArchived} className="bg-slate-800 border-slate-600 text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed" />
                         </div>
                        <div>
                             <Label htmlFor="gecko_id_code">ID Code</Label>
                             <Input id="gecko_id_code" value={formData.gecko_id_code} onChange={(e) => handleChange('gecko_id_code', e.target.value)} disabled={isArchived} className="bg-slate-800 border-slate-600 text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed" />
                         </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label>Hatch Date</Label>
                            <div className="grid grid-cols-3 gap-2">
                                <Input
                                    placeholder="YYYY"
                                    maxLength={4}
                                    value={hatchYear}
                                     onChange={(e) => setHatchYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                                     disabled={isArchived}
                                     className="bg-slate-800 border-slate-600 text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <Select value={hatchMonth} onValueChange={setHatchMonth} disabled={isArchived}>
                                    <SelectTrigger className="h-10 bg-slate-800 border-slate-600 text-slate-100">
                                        <SelectValue placeholder="Month" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-600 text-slate-100 z-[99999]">
                                       <SelectItem value="none" className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">None</SelectItem>
                                       {MONTHS.map(m => (
                                           <SelectItem key={m.value} value={m.value} className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">{m.label}</SelectItem>
                                       ))}
                                    </SelectContent>
                                </Select>
                                <Input
                                    placeholder="DD"
                                    maxLength={2}
                                    value={hatchDay}
                                     onChange={(e) => setHatchDay(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                                     disabled={isArchived}
                                     className="bg-slate-800 border-slate-600 text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="sex">Sex *</Label>
                            <Select value={formData.sex} onValueChange={(v) => handleChange('sex', v)} disabled={isArchived}>
                                <SelectTrigger className="h-10 bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-600 text-slate-100 z-[99999]">
                                    <SelectItem value="Unsexed" className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">Unsexed</SelectItem>
                                    <SelectItem value="Male" className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">Male</SelectItem>
                                    <SelectItem value="Female" className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">Female</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="species">Species</Label>
                        <Select value={formData.species || 'Crested Gecko'} onValueChange={(v) => handleChange('species', v)} disabled={isArchived}>
                            <SelectTrigger className="h-10 bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600 text-slate-100 z-[99999]">
                                {GECKO_SPECIES.map(s => (
                                    <SelectItem key={s} value={s} className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ParentAutocomplete
                            id="sire_input"
                            label="Sire (Father)"
                            placeholder="Type or browse males..."
                            value={sireInput}
                            onChange={handleSireInputChange}
                            onSelect={(s) => {
                                setSireInput(`${s.name} (${s.gecko_id_code || 'No ID'})`);
                                setSireId(s.id);
                            }}
                            geckos={userGeckos.filter((g) => g.sex === 'Male' && g.id !== gecko?.id)}
                            disabled={isArchived}
                        />
                        <ParentAutocomplete
                            id="dam_input"
                            label="Dam (Mother)"
                            placeholder="Type or browse females..."
                            value={damInput}
                            onChange={handleDamInputChange}
                            onSelect={(d) => {
                                setDamInput(`${d.name} (${d.gecko_id_code || 'No ID'})`);
                                setDamId(d.id);
                            }}
                            geckos={userGeckos.filter((g) => g.sex === 'Female' && g.id !== gecko?.id)}
                            disabled={isArchived}
                        />
                    </div>

                    {/* For Sale Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
                        <div className="flex-1">
                            <Label className="text-base font-medium flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-yellow-600" />
                                List for Sale
                            </Label>
                            <p className="text-sm text-sage-600 dark:text-sage-300 mt-1">Makes the gecko visible on the marketplace.</p>
                        </div>
                        <Switch
                             checked={isForSale}
                             onCheckedChange={handleForSaleToggle}
                             disabled={isArchived}
                             className="data-[state=checked]:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                         />
                    </div>
                    
                    {/* Public Display Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
                        <div>
                            <Label htmlFor="is_public" className="text-base">Public Display</Label>
                            <p className="text-xs text-slate-400">Show in public profile and marketplace</p>
                        </div>
                        <Switch
                             id="is_public"
                             checked={formData.is_public !== false}
                             onCheckedChange={(checked) => handleChange('is_public', checked)}
                             disabled={isArchived}
                             className="disabled:opacity-50 disabled:cursor-not-allowed"
                         />
                    </div>
                    
                    {/* Gallery Display Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
                        <div>
                            <Label htmlFor="gallery_display" className="text-base">Gallery Display</Label>
                            <p className="text-xs text-slate-400">Show in public gallery</p>
                        </div>
                        <Switch
                             id="gallery_display"
                             checked={formData.gallery_display || false}
                             onCheckedChange={(checked) => handleChange('gallery_display', checked)}
                             disabled={isArchived}
                             className="disabled:opacity-50 disabled:cursor-not-allowed"
                         />
                    </div>

                    {/* Gravid — Female only */}
                    {formData.sex === 'Female' && (
                        <div className="space-y-3 p-4 bg-pink-950/30 border border-pink-800/40 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-base font-medium text-pink-300">Gravid (Pregnant)</Label>
                                    <p className="text-xs text-slate-400 mt-0.5">Toggle on if this female is currently gravid</p>
                                </div>
                                <Switch
                                    checked={formData.is_gravid || false}
                                    onCheckedChange={(checked) => handleChange('is_gravid', checked)}
                                    disabled={isArchived}
                                    className="data-[state=checked]:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                            </div>
                            {formData.is_gravid && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                    <div>
                                        <Label className="text-sm text-slate-300">Gravid Since</Label>
                                        <Input
                                            type="date"
                                            value={formData.gravid_since || ''}
                                            onChange={(e) => handleChange('gravid_since', e.target.value)}
                                            disabled={isArchived}
                                            className="bg-slate-800 border-slate-600 text-slate-100 mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-sm text-slate-300">Expected / Actual Egg Drop Date</Label>
                                        <Input
                                            type="date"
                                            value={formData.egg_drop_date || ''}
                                            onChange={(e) => handleChange('egg_drop_date', e.target.value)}
                                            disabled={isArchived}
                                            className="bg-slate-800 border-slate-600 text-slate-100 mt-1"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="status">Status</Label>
                            <Select value={formData.status} onValueChange={(v) => handleChange('status', v)} disabled={isForSale || isArchived}>
                                <SelectTrigger className="h-10 bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-600 text-slate-100 z-[99999]">
                                    <SelectItem value="Pet" className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">Pet</SelectItem>
                                    <SelectItem value="Future Breeder" className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">Future Breeder</SelectItem>
                                    <SelectItem value="Holdback" className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">Holdback</SelectItem>
                                    <SelectItem value="Ready to Breed" className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">Ready to Breed</SelectItem>
                                    <SelectItem value="Proven" className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">Proven</SelectItem>
                                    <SelectItem value="For Sale" className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">For Sale</SelectItem>
                                    <SelectItem value="Sold" className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">Sold</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="asking_price">Asking Price ($)</Label>
                            <Input 
                                 id="asking_price" 
                                 type="number" 
                                 step="0.01" 
                                 value={formData.asking_price} 
                                 onChange={(e) => handleChange('asking_price', e.target.value)} 
                                 placeholder="e.g., 250.00"
                                 disabled={isArchived}
                                 className="bg-slate-800 border-slate-600 text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                             />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="weight_grams">Current Weight (grams)</Label>
                        <Input 
                             id="weight_grams" 
                             type="number" 
                             step="0.1" 
                             value={formData.weight_grams} 
                             onChange={(e) => handleChange('weight_grams', e.target.value)} 
                             placeholder="e.g., 50.3"
                             disabled={isArchived}
                             className="bg-slate-800 border-slate-600 text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                         />
                    </div>

                    <div>
                        <Label htmlFor="morphs_traits">Morphs & Traits (Free Text)</Label>
                        <Textarea id="morphs_traits" value={formData.morphs_traits} onChange={(e) => handleChange('morphs_traits', e.target.value)} disabled={isArchived} className="bg-slate-800 border-slate-600 text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed" />
                    </div>

                    {/* Morph ID Tags */}
                     <MorphIDSelector
                         selectedMorphs={formData.morph_tags || []}
                         onMorphsChange={(tags) => handleChange('morph_tags', tags)}
                         disabled={isArchived}
                     />

                    {/* Feeding Group */}
                    <div>
                        <Label>Feeding Group</Label>
                        <Select value={formData.feeding_group_id || 'none'} onValueChange={(v) => handleChange('feeding_group_id', v === 'none' ? null : v)} disabled={isArchived}>
                            <SelectTrigger className="h-10 bg-slate-800 border-slate-600 text-slate-100">
                                <SelectValue placeholder="No group assigned" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600 text-slate-100 z-[99999]">
                                <SelectItem value="none" className="text-slate-100 focus:bg-slate-700 focus:text-white">No group</SelectItem>
                                {feedingGroups.map(g => (
                                    <SelectItem key={g.id} value={g.id} className="text-slate-100 focus:bg-slate-700 focus:text-white">
                                        Group {g.label}{g.name ? ` — ${g.name}` : ''} ({g.diet_type})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {feedingGroups.length === 0 && (
                            <p className="text-xs text-slate-500 mt-1">Create feeding groups in the Project Manager.</p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea id="notes" value={formData.notes} onChange={(e) => handleChange('notes', e.target.value)} disabled={isArchived} className="bg-slate-800 border-slate-600 text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed" />
                    </div>
                    
                    {/* Enhanced Images Section */}
                    <div>
                        <Label>Images</Label>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                            {formData.image_urls.map((url, index) => (
                                <div key={url} className="relative group">
                                    <div 
                                        className="w-full h-24 rounded overflow-hidden cursor-pointer border-2 border-transparent hover:border-sage-300"
                                        onClick={() => handleImageCrop(url)}
                                    >
                                        <img 
                                            src={url} 
                                            alt={`gecko ${index + 1}`} 
                                            className="w-full h-full object-cover"
                                            style={{
                                                objectPosition: cropData[url] 
                                                    ? `${cropData[url].x}% ${cropData[url].y}%`
                                                    : '50% 50%' // Default to center if no crop data
                                            }}
                                        />
                                    </div>
                                    <Button 
                                        type="button" 
                                        size="icon" 
                                        variant="destructive" 
                                        className="absolute top-1 right-1 h-6 w-6" // Removed opacity classes
                                        onClick={() => removeImage(url)}
                                    >
                                        <X className="h-4 w-4"/>
                                    </Button>
                                    {/* Removed: Click to adjust overlay */}
                                </div>
                            ))}
                        </div>
                        <Button asChild variant="outline" className="w-full">
                            <label className="cursor-pointer">
                                <Upload className="w-4 h-4 mr-2"/> Upload Images
                                <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload}/>
                            </label>
                        </Button>
                    </div>

                    {/* Certificate Generation Section */}
                    {gecko && gecko.id && (
                        <div className="p-4 border border-dashed border-slate-600 rounded-lg mt-6 bg-slate-800/50">
                            <h3 className="text-lg font-medium mb-2 text-slate-200">Generate Certificate</h3>
                            <p className="text-sm text-slate-400 mb-4">
                                Create a professional, printable certificate for your records or for new owners.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="border-slate-500 hover:bg-slate-700"
                                    onClick={() => handleGenerateCertificate('ownership')}
                                    disabled={isGeneratingCert}
                                >
                                    {isGeneratingCert && certType === 'ownership' 
                                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                                        : <><Award className="w-4 h-4 mr-2" /> Ownership Certificate</>
                                    }
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="border-slate-500 hover:bg-slate-700"
                                    onClick={() => handleGenerateCertificate('lineage')}
                                    disabled={isGeneratingCert}
                                >
                                    {isGeneratingCert && certType === 'lineage' 
                                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                                        : <><GitBranch className="w-4 h-4 mr-2" /> Lineage Certificate</>
                                    }
                                </Button>
                            </div>
                        </div>
                    )}
                </form>

                <CardFooter className="flex-shrink-0 mt-auto bg-slate-900 border-t border-slate-700 p-4 flex justify-end items-center gap-4">
                    {gecko && onDelete && !isArchived && (
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="h-10">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Archive
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-slate-900 border-slate-700">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="text-slate-100">Archive {gecko.name}?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-slate-400">
                                        This will archive <strong>{gecko.name}</strong> and hide it from your active collection. You can restore it later from the archive.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-600">Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-700 hover:bg-red-800">
                                        Archive Gecko
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                            </AlertDialog>
                            )}
                            {isArchived && (
                            <div className="h-10 px-4 rounded border border-slate-600 bg-slate-800 flex items-center text-slate-400 text-sm font-medium cursor-not-allowed">
                            Archived
                            </div>
                            )}
                    <Button variant="outline" onClick={onCancel} className="h-10 border-slate-600 text-slate-300 hover:bg-slate-800">Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 h-10">
                        {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {getSaveButtonText()}
                    </Button>
                </CardFooter>
            </Card>

            {/* Image Crop Dialog */}
            {cropDialogOpen && currentImage && (
                <ImageCropDialog
                    imageUrl={currentImage}
                    initialCrop={cropData[currentImage]}
                    onSave={(cropInfo) => saveCropData(currentImage, cropInfo)}
                    onClose={() => setCropDialogOpen(false)}
                />
            )}
        </motion.div>
    );
}

// ImageCropDialog moved to ./form/ImageCropDialog.jsx