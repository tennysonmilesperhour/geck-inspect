import { captureEvent } from '@/lib/posthog';
import { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Gecko, FeedingGroup, Collection, CollectionMember, mergeGeckoSalePrices } from '@/entities/all';
import { UploadFile } from '@/integrations/Core';
import { notifyFollowersNewGecko, checkAndNotifyLevelUp } from '@/components/notifications/NotificationService';
import { useToast } from '@/components/ui/use-toast';
import { todayLocalISO, parseLocalDate } from '@/lib/dateUtils';
import { canonicalizeMorphTags } from '@/lib/genetics';
import { FIRE_SLOTS, assignFireState, fireStatePhotos, photoFireState } from '@/lib/fireStatePhotos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CardHeader, CardFooter } from '@/components/ui/card';
import { format } from "date-fns";
import { Upload, X, DollarSign, Loader2, Archive, GripVertical, Camera, Star, ChevronDown } from "lucide-react";
import { Switch } from '@/components/ui/switch';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import MorphIDSelector from './MorphIDSelector';
import QualityInput from './QualityInput';
import { patternGradeForScore } from '@/lib/quality';
// Extracted helpers / constants / sub-components, keeps this file focused
// on the orchestration logic instead of static data and pure UI pieces.
import { MONTHS, INITIAL_FORM_DATA, LIFE_STAGES } from './form/constants';
import { feedingGroupForWeight, generateNextGeckoId } from './form/helpers';
import FormSection from './form/FormSection';
import { hatchDateFromParts, hatchDateStatus, hatchFieldsFromParts, hatchYearOnly, parseDateText } from './form/hatchDate';
import { clearGeckoFormDraft, readGeckoFormDraft, saveGeckoFormDraft } from './form/draft';
import ImageCropDialog from './form/ImageCropDialog';
import ParentAutocomplete from './form/ParentAutocomplete';
import { parentNameForSave } from '@/lib/parentNames';
import { isNativePlatform } from '@/lib/revenuecat';
import { captureDevicePhoto } from '@/lib/devicePhoto';
import GeckoArtworkPicker from './form/GeckoArtworkPicker';
import { normalizeGeckoArtStyle } from '@/lib/geckoPlaceholderProfiles';

// Back-compat alias so the rest of this file doesn't need to change
const initialFormData = INITIAL_FORM_DATA;

/**
 * The long gecko form: every field of a gecko, in six headed sections with
 * photos first (experience review D2). "Add Gecko" opens Quick Add; this
 * form is behind its "More details" button and behind Edit.
 *
 * restoreDraftOnOpen: open a new gecko with the member's kept draft already
 * restored (Quick Add's "Pick it up"), instead of offering it.
 */
export default function GeckoForm({ gecko, userGeckos, currentUser, onSubmit, onCancel, isHatching = false, onArchive, onMarkSold, breedingPlan = null, feedingGroups: feedingGroupsProp = null, idSettings = null, restoreDraftOnOpen = false }) {
    const { toast } = useToast();
    const saveRequestId = useRef(crypto.randomUUID());
    const savingRef = useRef(false);
    const formRef = useRef(null);
    // Set by the first change the member makes (typing, a switch, a photo).
    // Closing the form used to throw away everything entered, and every
    // photo uploaded, without a word: a tap outside the window was enough.
    // Now a changed form asks once before it closes.
    const dirtyRef = useRef(false);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    // An unsaved NEW gecko is also kept in this browser while the form is
    // open, so a closed tab or a reload does not lose it (experience
    // review D3; ./form/draft.js). A draft found when the form opens is
    // offered back in one line at the top.
    const keepsDraft = !gecko?.id && !isHatching;
    const [draftOffer, setDraftOffer] = useState(() => (keepsDraft ? readGeckoFormDraft(currentUser) : null));
    const draftOfferRef = useRef(draftOffer);
    // Set once the gecko is saved or the form discarded: no draft after that.
    const draftDoneRef = useRef(false);
    const dropDraftOffer = () => {
        if (!draftOfferRef.current) return;
        draftOfferRef.current = null;
        setDraftOffer(null);
    };
    const markDirty = () => {
        dirtyRef.current = true;
        // The first change takes over the draft slot, so the earlier draft
        // is no longer on offer.
        dropDraftOffer();
    };
    // Section toggles, the morph search and the draft line carry
    // data-no-dirty: using them changes nothing about the gecko.
    const countsAsChange = (target) => !target.closest?.('[data-no-dirty]');
    // A phone opens on Photos and Identity with the rest folded; a wider
    // screen shows every section.
    const [openSections, setOpenSections] = useState(() => {
        const narrow = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(max-width: 639px)')?.matches);
        return { photos: true, identity: true, parents: !narrow, morph: !narrow, selling: !narrow, care: !narrow };
    });
    const toggleSection = (id) => setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
    const [artworkOpen, setArtworkOpen] = useState(false);
    // A folded section must never hide a field with an error: the browser
    // cannot point at a hidden field, so the save would fail with no word.
    // Called before the browser checks the form, and before our own checks.
    const showSections = (ids) => {
        if (ids.length === 0) return;
        flushSync(() => setOpenSections((prev) => (ids.every((id) => prev[id]) ? prev : { ...prev, ...Object.fromEntries(ids.map((id) => [id, true])) })));
    };
    const revealInvalidFields = () => {
        let invalid = [];
        try {
            invalid = Array.from(formRef.current?.querySelectorAll(':invalid') || []);
        } catch {
            // a browser without :invalid has nothing to reveal
        }
        showSections([...new Set(invalid.map((el) => el.closest('[data-form-section]')?.getAttribute('data-form-section')).filter(Boolean))]);
    };
    const showField = (sectionId, fieldId) => {
        showSections([sectionId]);
        formRef.current?.querySelector(`#${fieldId}`)?.focus();
    };
    const requestClose = () => {
        if (savingRef.current) return;
        if (dirtyRef.current) { setConfirmDiscard(true); return; }
        onCancel();
    };
    const isArchived = gecko?.archived;
    const [formData, setFormData] = useState(initialFormData);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
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
    const [confirmPrivate, setConfirmPrivate] = useState(false);
    
    // New states for certificate generation
    // isGeneratingCert / certType state removed, certificates live on the view modal now.
    const [feedingGroups, setFeedingGroups] = useState([]);
    // Collections the user can write to (own + editor memberships).
    // Drives the Collection picker. Empty / single-entry → picker
    // hides because there's nothing meaningful to choose between.
    const [writableCollections, setWritableCollections] = useState([]);
    // A new gecko is the member's own; an existing one only when they
    // created it.
    const isOwnGecko = !gecko?.id
        || String(gecko.created_by || '').toLowerCase() === String(currentUser?.email || '').toLowerCase()
        || (gecko.owner_profile_id != null && currentUser?.id != null && String(gecko.owner_profile_id) === String(currentUser.id));
    // sire/dam suggestion visibility + refs now live inside ParentAutocomplete

    useEffect(() => {
        if (feedingGroupsProp) {
            setFeedingGroups(feedingGroupsProp);
        } else {
            FeedingGroup.list()
                .then(setFeedingGroups)
                .catch((err) => console.error('Failed to load feeding groups:', err));
        }
    }, [feedingGroupsProp]);

    // Load every collection the user can write to. Owners get every
    // collection they own; editors get the collections they were
    // invited into. Viewers get nothing here, they can't create or
    // move geckos. The intersection of CollectionMember rows and
    // Collection rows gives us the writable set.
    useEffect(() => {
        let cancelled = false;
        if (!currentUser?.email) return;
        Promise.all([
            Collection.filter({}).catch(() => []),
            CollectionMember.filter({ status: 'accepted' }).catch(() => []),
        ]).then(([cols, mems]) => {
            if (cancelled) return;
            const writableIds = new Set(
                (mems || [])
                    .filter((m) => m.role === 'owner' || m.role === 'editor')
                    .map((m) => m.collection_id),
            );
            const list = (cols || []).filter((c) => writableIds.has(c.id));
            // Default collection sorts first; everything else by name.
            list.sort((a, b) => {
                if (a.is_default && !b.is_default) return -1;
                if (!a.is_default && b.is_default) return 1;
                return (a.name || '').localeCompare(b.name || '');
            });
            setWritableCollections(list);
        });
        return () => { cancelled = true; };
    }, [currentUser?.email]);

    const handleChange = useCallback((field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    // Effect 1: Initialize form data when gecko changes or new gecko is created
    const initialisedFor = useRef(undefined);
    useEffect(() => {
        // The collection reloading behind the form (a new array, the same
        // gecko) must not wipe what the member has typed since it opened.
        const sameGecko = initialisedFor.current !== undefined
            && (gecko?.id ? initialisedFor.current?.id === gecko.id : initialisedFor.current === (gecko || null));
        if (sameGecko && dirtyRef.current) return;
        initialisedFor.current = gecko || null;
        if (gecko) {
            // We are editing an existing gecko or initializing a new hatched one (with pre-filled parents).
            const formDataToSet = {
                ...initialFormData, // Start with default values
                ...gecko,     // Overlay gecko data
                image_urls: gecko.image_urls || [], // Ensure image_urls is always an array
                // Ensure number fields are string for input type="number"
                weight_grams: gecko.weight_grams !== undefined && gecko.weight_grams !== null ? gecko.weight_grams.toString() : '',
                asking_price: gecko.asking_price !== undefined && gecko.asking_price !== null ? gecko.asking_price.toString() : '',
                marketplace_description: gecko.marketplace_description || '',
                // Set defaults for other fields if null/undefined
                name: gecko.name || '',
                gecko_id_code: gecko.gecko_id_code || '',
                hatch_date: gecko.hatch_date ? parseLocalDate(gecko.hatch_date) : null,
                sex: gecko.sex || 'Unsexed',
                morphs_traits: gecko.morphs_traits || '',
                notes: gecko.notes || '',
                status: gecko.status || 'Pet',
                image_crop_data: gecko.image_crop_data || {},
                placeholder_style: normalizeGeckoArtStyle(gecko.placeholder_style),
                growth_slideshow_enabled: gecko.growth_slideshow_enabled || false,
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

            // Drafts (from Quick Add's "More details" or an AI Morph ID
            // result) are new geckos too, so they get an ID code the same
            // way a blank add does. Hatchlings get theirs from Effect 2.
            // What Quick Add or Morph ID handed over is unsaved work too:
            // closing the form asks first, and it is kept as the draft.
            if (!gecko.id && !isHatching && (gecko.name || gecko.morphs_traits || gecko.notes || gecko.weight_grams != null
                || gecko.hatch_date || gecko.image_urls?.length || gecko.morph_tags?.length)) {
                dirtyRef.current = true;
            }
            if (!gecko.id && !gecko.gecko_id_code && !isHatching) {
                const sire = gecko.sire_id ? userGeckos.find(g => g.id === gecko.sire_id) : null;
                const dam = gecko.dam_id ? userGeckos.find(g => g.id === gecko.dam_id) : null;
                generateNextGeckoId(currentUser, userGeckos, sire, dam, '', '', idSettings)
                    .then((newId) => {
                        setFormData(prev => (prev.gecko_id_code ? prev : { ...prev, gecko_id_code: newId }));
                    })
                    .catch((err) => console.warn('ID code not generated for draft:', err));
            }

            // Also, parse the date parts for the UI inputs. A gecko with a
            // hatch year and no date shows the year alone.
            const date = gecko.hatch_date ? parseLocalDate(gecko.hatch_date) : null;
            if (date && !isNaN(date.getTime())) {
                setHatchYear(date.getFullYear().toString());
                setHatchMonth((date.getMonth() + 1).toString());
                setHatchDay(date.getDate().toString());
            } else {
                const yearOnly = hatchYearOnly(gecko);
                setHatchYear(yearOnly ? String(yearOnly) : '');
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
            // We are creating a new gecko from scratch. Set the initial state,
            // then fill in the ID code once it is generated (only the code,
            // so a draft restored in the meantime is not wiped).
            setFormData(initialFormData);
            generateNextGeckoId(currentUser, userGeckos, null, null, '', '', idSettings)
                .then((newId) => {
                    setFormData(prev => (prev.gecko_id_code ? prev : { ...prev, gecko_id_code: newId }));
                })
                .catch((err) => console.warn('ID code not generated:', err));
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
                const newId = await generateNextGeckoId(currentUser, userGeckos, sire, dam, '', '', idSettings);
                setFormData(prev => ({ ...prev, gecko_id_code: newId }));
            }
        };
        generateIdForHatched();
    }, [gecko, currentUser, userGeckos, isHatching, formData.gecko_id_code, breedingPlan]);

    // Effect 3: Construct date from parts. Only a real, complete date is
    // saved as the hatch date (see ./form/hatchDate.js); anything less keeps
    // just the year, when there is one.
    useEffect(() => {
        handleChange('hatch_date', hatchDateFromParts(hatchYear, hatchMonth, hatchDay));
    }, [hatchYear, hatchMonth, hatchDay, handleChange]);
    const hatchDateNow = hatchDateFromParts(hatchYear, hatchMonth, hatchDay);
    const hatchStatus = hatchDateStatus(hatchYear, hatchMonth, hatchDay);
    // The year a save keeps when the row holds less than a whole date.
    const hatchYearKept = hatchFieldsFromParts(hatchYear, hatchMonth, hatchDay).estimated_hatch_year;

    // A full date pasted, autofilled or dropped into Year or Day fills all
    // three boxes (2026-02-24, 02/24/2026, 24 Feb 2026).
    const fillHatchDate = (text) => {
        const parsed = parseDateText(text);
        if (!parsed) return false;
        setHatchYear(parsed.year);
        setHatchMonth(parsed.month);
        setHatchDay(parsed.day);
        return true;
    };
    const handleHatchPaste = (event) => {
        if (!fillHatchDate(event.clipboardData?.getData('text'))) return;
        // The paste is handled here, so the box never fires its own change.
        event.preventDefault();
        markDirty();
    };
    const handleHatchBox = (value, setPart, maxLength) => {
        if (/\D/.test(value) && fillHatchDate(value)) return;
        setPart(value.replace(/[^0-9]/g, '').slice(0, maxLength));
    };

    // The kept draft: what the form holds now, without photo files.
    const currentDraft = () => ({
        form: formData,
        hatch: { year: hatchYear, month: hatchMonth, day: hatchDay },
        sire: { input: sireInput, id: sireId },
        dam: { input: damInput, id: damId },
        crop: cropData,
    });
    // Written on every change once the member has changed something, and
    // never while an earlier draft is still on offer (that one stays put
    // until the member restores it, starts fresh or makes a change).
    useEffect(() => {
        if (!keepsDraft || !dirtyRef.current || draftDoneRef.current || draftOfferRef.current) return;
        saveGeckoFormDraft(currentUser, currentDraft());
    });

    const restoreDraft = (draft) => {
        if (!draft) return;
        dropDraftOffer();
        const taken = new Set(userGeckos.map((g) => g.gecko_id_code).filter(Boolean));
        setFormData((prev) => ({
            ...initialFormData,
            ...draft.form,
            hatch_date: null,
            image_crop_data: draft.crop,
            // Keep the ID code typed back then, unless another gecko has
            // taken it since; then keep the one generated for this form.
            gecko_id_code: draft.form.gecko_id_code && !taken.has(draft.form.gecko_id_code) ? draft.form.gecko_id_code : prev.gecko_id_code,
        }));
        setHatchYear(draft.hatch.year);
        setHatchMonth(draft.hatch.month);
        setHatchDay(draft.hatch.day);
        // A parent deleted since the draft was kept stays as a typed name.
        const stillThere = (id) => (id && userGeckos.some((g) => g.id === id) ? id : '');
        setSireInput(draft.sire.input);
        setSireId(stillThere(draft.sire.id));
        setDamInput(draft.dam.input);
        setDamId(stillThere(draft.dam.id));
        setCropData(draft.crop);
        setIsForSale(draft.form.status === 'For Sale');
        dirtyRef.current = true;
    };
    const startFresh = () => {
        clearGeckoFormDraft(currentUser);
        dropDraftOffer();
    };
    // Quick Add's "Pick it up" opens the form with the draft already in it.
    const restoreOnOpenRef = useRef(restoreDraftOnOpen);
    useEffect(() => {
        if (!restoreOnOpenRef.current) return;
        restoreOnOpenRef.current = false;
        restoreDraft(draftOfferRef.current);
    });

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

    // Helper: keep the linked FK in sync with the typed text. If the
    // text matches a gecko in the collection we set the FK; if it doesn't
    // (and isn't equal to the currently-selected gecko's display string)
    // we clear it so the typed name is saved as a free-text breeder
    // reference (sire_name / dam_name). Without this, switching from
    // a selected collection parent to an outside breeder kept the old
    // FK and silently dropped the typed name on save.
    const syncParent = (value, sex, currentId, setId) => {
        if (value === '') {
            setId('');
            return;
        }
        const matchingGecko = userGeckos.find(g =>
            g.sex === sex && (
                `${g.name} (${g.gecko_id_code || 'No ID'})` === value ||
                g.name.toLowerCase() === value.toLowerCase() ||
                (g.gecko_id_code && g.gecko_id_code.toLowerCase() === value.toLowerCase())
            )
        );
        if (matchingGecko) {
            setId(matchingGecko.id);
            return;
        }
        // No match. If we currently hold an FK whose display string no
        // longer matches the typed text, the user has clearly moved on
        // to an outside breeder, drop the FK.
        if (currentId) {
            const current = userGeckos.find(g => g.id === currentId);
            const currentDisplay = current ? `${current.name} (${current.gecko_id_code || 'No ID'})` : '';
            if (value !== currentDisplay) setId('');
        }
    };

    const handleSireInputChange = (value) => {
        setSireInput(value);
        syncParent(value, 'Male', sireId, setSireId);
    };

    const handleDamInputChange = (value) => {
        setDamInput(value);
        syncParent(value, 'Female', damId, setDamId);
    };
    
    // Upload uses its own isUploadingImage flag so an upload failure
    // doesn't flip the form's isSaving and make the form appear stuck
    // in submit state.
    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        // Always clear the input so re-selecting the same file still fires.
        if (e.target) e.target.value = '';
        if (files.length === 0) return;

        setIsUploadingImage(true);
        const urls = [...formData.image_urls];
        const newCropData = { ...cropData };
        let uploadedCount = 0;
        let failedCount = 0;
        let lastUploadError = null;

        for (const file of files) {
            try {
                const { file_url } = await UploadFile({ file });
                urls.push(file_url);
                newCropData[file_url] = { x: 50, y: 50 };
                uploadedCount++;
            } catch (err) {
                console.error('Image upload failed', err);
                failedCount++;
                lastUploadError = err;
            }
        }

        if (uploadedCount > 0) {
            setFormData(prev => ({ ...prev, image_urls: urls }));
            setCropData(newCropData);
        }
        if (failedCount > 0) {
            toast({
                title: uploadedCount > 0 ? 'Some uploads failed' : 'Upload failed',
                // Show the real reason (the storage quota message, for one)
                // instead of always blaming the file size.
                description:
                    lastUploadError?.message ||
                    (failedCount === 1
                        ? 'One image could not be uploaded. Try a smaller file or different format.'
                        : `${failedCount} images could not be uploaded.`),
                variant: 'destructive',
            });
        }
        // Success state is conveyed by the new thumbnail appearing in the
        // grid above; suppressing the toast keeps it from floating over
        // the "Add Gecko" submit button after a quick upload.

        setIsUploadingImage(false);
    };

    const handleImageCrop = (imageUrl) => {
        setCurrentImage(imageUrl);
        setCropDialogOpen(true);
    };

    // Crop dialog returns the full meta object now ({ x, y, rotation, ... }).
    // Merge against any existing per-URL data so we don't drop life_stage or
    // other future keys that aren't part of the focal/rotation dialog.
    const saveCropData = (url, cropInfo) => {
        setCropData(prev => ({
            ...prev,
            [url]: { ...(prev[url] || {}), ...cropInfo },
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
    };

    const setLifeStage = (url, stage) => {
        setCropData(prev => ({
            ...prev,
            [url]: { ...(prev[url] || { x: 50, y: 50 }), life_stage: stage || undefined },
        }));
    };

    // Fired-up and fired-down slots: one photo each, tagged in
    // image_crop_data (see src/lib/fireStatePhotos.js).
    const setFireState = (url, state) => {
        setCropData(prev => assignFireState(prev, url, state));
    };

    const handleSlotUpload = async (e, state) => {
        const file = e.target.files?.[0];
        if (e.target) e.target.value = '';
        if (!file) return;
        setIsUploadingImage(true);
        try {
            const { file_url } = await UploadFile({ file });
            setFormData(prev => ({ ...prev, image_urls: [...prev.image_urls, file_url] }));
            setCropData(prev => assignFireState(prev, file_url, state));
        } catch (err) {
            console.error('Image upload failed', err);
            toast({
                title: 'Upload failed',
                description: err?.message || 'The photo could not be uploaded. Try a smaller file or a different format.',
                variant: 'destructive',
            });
        } finally {
            setIsUploadingImage(false);
        }
    };

    const fireSlotPhotos = fireStatePhotos({ image_urls: formData.image_urls, image_crop_data: cropData });

    const handleImageDragEnd = (result) => {
        if (!result.destination) return;
        if (result.destination.index === result.source.index) return;
        setFormData(prev => {
            const next = [...prev.image_urls];
            const [moved] = next.splice(result.source.index, 1);
            next.splice(result.destination.index, 0, moved);
            return { ...prev, image_urls: next };
        });
    };

    const makePrimary = (url) => {
        setFormData(prev => {
            const idx = prev.image_urls.indexOf(url);
            if (idx <= 0) return prev;
            const next = [...prev.image_urls];
            next.splice(idx, 1);
            next.unshift(url);
            return { ...prev, image_urls: next };
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (savingRef.current) return;
        savingRef.current = true;
        setIsSaving(true);
        
        try {
            // Construct the payload directly from the most recent form state.
            // Using `null` for empty parent fields for better database consistency.
            const weightValue = formData.weight_grams !== '' && formData.weight_grams !== null
                ? parseFloat(formData.weight_grams)
                : null;
            // A whole date, or the year alone (./form/hatchDate.js).
            const hatch = hatchFieldsFromParts(hatchYear, hatchMonth, hatchDay);
            const dataToSave = {
                name: formData.name.trim(),
                is_public: formData.is_public === true,
                gallery_display: formData.is_public === true && formData.gallery_display === true,
                gecko_id_code: formData.gecko_id_code,
                hatch_date: hatch.hatch_date,
                // Mirror the latest weight onto the gecko row so cards and
                // the detail page show it immediately, without waiting for
                // the WeightRecord query to resolve. The WeightRecord row
                // created below remains the source of truth for history.
                weight_grams: weightValue,
                sex: formData.sex,
                sire_id: sireId || null,
                dam_id: damId || null,
                // Keep the parent's name even when it is linked, so the tree
                // still shows it if the parent later goes private, is
                // deleted, or stays with the seller after a transfer.
                sire_name: parentNameForSave({ parentId: sireId, input: sireInput, parents: userGeckos, storedName: gecko?.sire_id === sireId ? gecko?.sire_name : null }),
                dam_name: parentNameForSave({ parentId: damId, input: damInput, parents: userGeckos, storedName: gecko?.dam_id === damId ? gecko?.dam_name : null }),
                morphs_traits: formData.morphs_traits,
                // Canonicalize on write so spelling variants ('Lily White')
                // never reach the database; filters and analytics rely on it.
                morph_tags: canonicalizeMorphTags(formData.morph_tags || []),
                feeding_group_id: formData.feeding_group_id || null,
                notes: formData.notes,
                status: formData.status,
                image_urls: formData.image_urls,
                asking_price: formData.asking_price !== '' && formData.asking_price !== null ?
                             parseFloat(formData.asking_price) : null,
                marketplace_description: formData.marketplace_description || null,
                image_crop_data: cropData,
                placeholder_style: normalizeGeckoArtStyle(formData.placeholder_style),
                species: formData.species || 'Crested Gecko',
                // Pass the chosen collection through so the new row lands
                // in the right bucket. If null, the
                // geckos_set_default_collection trigger fills in the
                // user's default collection on insert (existing rows
                // keep their previous collection_id when null is passed
                // because Supabase only updates non-undefined columns).
                collection_id: formData.collection_id || null,
                is_gravid: formData.sex === 'Female' ? (formData.is_gravid || false) : false,
                gravid_since: formData.sex === 'Female' && formData.is_gravid ? (formData.gravid_since || null) : null,
                egg_drop_date: formData.sex === 'Female' && formData.is_gravid ? (formData.egg_drop_date || null) : null,
                // P11 Quality Scale. quality_score is the source of truth;
                // pattern_grade is mirrored from the derived tier so Market
                // Pricing aggregations keep working without a backfill.
                quality_score: formData.quality_score == null || formData.quality_score === ''
                    ? null
                    : Number(formData.quality_score),
                pattern_grade: patternGradeForScore(formData.quality_score) ?? formData.pattern_grade ?? null,
                tail_status: formData.tail_status || null,
                growth_slideshow_enabled: !!formData.growth_slideshow_enabled,
            };
            // Sent when it keeps a year, or clears the year this gecko had
            // because a whole date replaces it or the row was emptied. So a
            // save with no year in it never depends on the database knowing
            // the field, and a year typed half-way never wipes a saved one.
            const hatchRowEmpty = !hatchYear && !hatchMonth && !hatchDay;
            if (hatch.estimated_hatch_year != null
                || (gecko?.estimated_hatch_year != null && (hatch.hatch_date || hatchRowEmpty))) {
                dataToSave.estimated_hatch_year = hatch.estimated_hatch_year;
            }

            const isNew = !gecko?.id || isHatching;
            if (!dataToSave.name) {
                showField('identity', 'name');
                throw new Error('Please enter a name.');
            }
            if (weightValue !== null && (!Number.isFinite(weightValue) || weightValue < 0)) {
                showField('care', 'weight_grams');
                throw new Error('Weight must be a valid, non-negative number.');
            }
            // Include automatic group assignment in the same transaction.
            if (weightValue !== null && !dataToSave.feeding_group_id) {
                const group = feedingGroupForWeight(feedingGroups, weightValue);
                if (group) dataToSave.feeding_group_id = group.id;
            }
            const recordWeight = weightValue !== null &&
                (isNew || gecko.weight_grams == null || Number(gecko.weight_grams) !== weightValue);
            const saveRecord = (record) => supabase.rpc('save_gecko_record', {
                p_record: record,
                p_gecko_id: isNew ? null : gecko.id,
                p_request_id: saveRequestId.current,
                p_record_weight: recordWeight,
                p_record_date: todayLocalISO(),
            });
            let { data: savedGecko, error: saveError } = await saveRecord(dataToSave);
            // The database learns the hatch year in the same release, and the
            // site can go live a minute before it. Until then a year is
            // refused, so save the rest, as the form did before, and say so.
            let yearHeldBack = false;
            if (saveError && 'estimated_hatch_year' in dataToSave && /Unsupported animal field/i.test(saveError.message || '')) {
                const { estimated_hatch_year: _held, ...withoutYear } = dataToSave;
                ({ data: savedGecko, error: saveError } = await saveRecord(withoutYear));
                yearHeldBack = !saveError;
            }
            if (saveError) throw saveError;
            // The saved row reads no sale price (it is kept apart, see
            // src/lib/geckoSalePrices.js); put it back before handing on.
            // The save has happened either way, so this never fails it.
            try {
                await mergeGeckoSalePrices(savedGecko);
            } catch {
                // Shown without its price until the next read.
            }
            // The saved row carries no owner email once members stop reading
            // it (decision E16). A new gecko is the saver's; an edited one
            // keeps the owner it had (none shown when that is another
            // member). So My Geckos still treats the member's own as theirs.
            const ownerEmail = isNew ? currentUser?.email : gecko?.created_by;
            if (savedGecko && savedGecko.created_by == null && ownerEmail) savedGecko.created_by = ownerEmail;
            // Saved, so the kept draft has done its job.
            draftDoneRef.current = true;
            if (keepsDraft) clearGeckoFormDraft(currentUser);
            captureEvent(isNew ? 'animal_created' : 'animal_updated', { animal_id: savedGecko.id, recorded_weight: recordWeight, published: savedGecko.is_public === true });
            // The weight is written inside save_gecko_record, not through the
            // WeightRecord entity, so it is counted here.
            if (recordWeight) captureEvent('weight_logged', { via: 'gecko_form', at_add: isNew });
            // Optional community activity must never turn a successful save into a failed form.
            // (No user_activity row any more: the animal_created event above
            // records the same thing, and the admin view reads that.)
            if (isNew && currentUser) {
                if (savedGecko.is_public === true) {
                    notifyFollowersNewGecko(savedGecko, currentUser.email, currentUser.full_name).catch(console.error);
                }
                checkAndNotifyLevelUp(currentUser.email).catch(console.error);
            }
            if (yearHeldBack && hatch.estimated_hatch_year != null) {
                toast({ title: `${savedGecko.name || 'Your gecko'} is saved, without the hatch year`, description: `An update is still finishing. Edit the gecko in a few minutes to add ${hatch.estimated_hatch_year} again.` });
            }

            if (onSubmit) {
                onSubmit(savedGecko, isNew);
            }
        } catch (error) {
            console.error('Failed to save gecko:', error);
            toast({ title: 'Gecko could not be saved', description: error.message || 'Your changes are still here. Please try again.', variant: 'destructive' });
        }
        savingRef.current = false;
        setIsSaving(false);
    };

    // Certificates are made from the gecko record (src/components/gecko/record).

    const getSaveButtonText = () => {
        if (isSaving) return 'Saving...';
        if (isHatching) return 'Record hatchling';
        if (gecko?.id) return 'Update gecko';
        return 'Add gecko';
    };

    // One line beside a folded section's heading, so it still says what is in it.
    const photoCount = formData.image_urls.length;
    const sectionSummary = {
        photos: photoCount ? `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}` : 'No photos yet',
        identity: [formData.name, formData.gecko_id_code].filter(Boolean).join(', '),
        parents: [sireInput, damInput].filter(Boolean).join(' x ') || 'Not set',
        morph: (formData.morph_tags || []).join(', ') || formData.morphs_traits || 'Not set',
        selling: [
            formData.status,
            formData.asking_price !== '' && formData.asking_price != null ? `$${formData.asking_price}` : null,
            formData.is_public === true ? 'public' : 'private',
        ].filter(Boolean).join(', '),
        care: [
            formData.weight_grams !== '' && formData.weight_grams != null ? `${formData.weight_grams} g` : null,
            formData.notes ? 'has notes' : null,
        ].filter(Boolean).join(', ') || 'Not set',
    };


    return (
        <Dialog open onOpenChange={(open) => { if (!open) requestClose(); }}>
            <DialogContent hideCloseButton onEscapeKeyDown={(event) => { if (cropDialogOpen) { event.preventDefault(); setCropDialogOpen(false); } }} aria-describedby="gecko-form-description" className="w-[95vw] max-w-4xl h-[90svh] bg-slate-900 border-slate-700 flex flex-col gap-0 p-0 overflow-hidden">
                <DialogDescription id="gecko-form-description" className="sr-only">Edit animal details and choose whether to publish them.</DialogDescription>
                <CardHeader className="flex-shrink-0">
                    <DialogTitle className="text-2xl text-slate-100">{gecko?.id && !isHatching ? `Edit ${gecko.name}` : (isHatching ? 'Record a new hatchling' : 'Add a gecko')}</DialogTitle>
                    {isHatching && breedingPlan && (
                        <p className="text-slate-400 text-sm">
                            From pairing: {breedingPlan.sire?.name || 'N/A'} x {breedingPlan.dam?.name || 'N/A'}
                        </p>
                    )}
                </CardHeader>

                <form
                    id="gecko-details-form"
                    ref={formRef}
                    onSubmit={handleSave}
                    onChangeCapture={(event) => { if (countsAsChange(event.target)) markDirty(); }}
                    onPointerDownCapture={(event) => {
                        // Switches, selects and toggle buttons do not fire
                        // a change event the form can hear.
                        if (event.target.closest?.('button, [role="switch"], [role="combobox"]') && countsAsChange(event.target)) markDirty();
                    }}
                    className="flex-grow overflow-y-auto space-y-4 p-4"
                >
                    {isArchived && (
                        <div className="space-y-4 mb-4">
                            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3">
                                <p className="text-sm text-yellow-200"><strong>This gecko is archived.</strong> Only the archive reason can be edited. Unarchive to make other changes.</p>
                            </div>
                            <div className="bg-slate-800 p-4 rounded-lg">
                                <p className="text-xs text-slate-400 mb-3">Archive reason:</p>
                                <div className="flex gap-2 flex-wrap">
                                    {[
                                        { value: 'death', label: 'Passed away' },
                                        { value: 'sold', label: 'Sold' },
                                        { value: 'other', label: 'Other' },
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={async () => {
                                                // type="button": inside the form, a plain button
                                                // also submitted it, running a second full save.
                                                // Sold asks for the price first, same as archiving.
                                                if (opt.value === 'sold' && gecko.archive_reason !== 'sold' && onMarkSold) {
                                                    onMarkSold(gecko.id);
                                                    return;
                                                }
                                                try {
                                                    await Gecko.update(gecko.id, { archive_reason: opt.value });
                                                    if (onSubmit) onSubmit(gecko);
                                                } catch (err) {
                                                    toast({ title: 'Archive reason not saved', description: err.message || 'Please try again.', variant: 'destructive' });
                                                }
                                            }}
                                            className={`touch:min-h-11 text-xs px-3 py-1.5 rounded border transition-colors ${
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

                    {draftOffer && (
                        <div data-no-dirty className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-2">
                            <p className="min-w-0 flex-1 basis-48 text-sm text-slate-100">
                                Pick up where you left off?{' '}
                                <span className="text-slate-400">
                                    {draftOffer.form.name ? `You were adding ${draftOffer.form.name}.` : 'You have an unfinished gecko.'}
                                </span>
                            </p>
                            <div className="flex gap-2">
                                <Button type="button" size="sm" onClick={() => restoreDraft(draftOffer)}>Restore</Button>
                                <Button type="button" size="sm" variant="outline" className="border-slate-600 text-slate-200" onClick={startFresh}>Start fresh</Button>
                            </div>
                        </div>
                    )}

                    {/* Six headed sections, photos first (experience review
                        D2). One wrapper, so the form's own spacing does not
                        add gaps between them. */}
                    <div>
                    <FormSection id="photos" title="Photos" summary={sectionSummary.photos} open={openSections.photos} onToggle={() => toggleSection('photos')}>
                        {/* Drag to reorder; the first photo is the primary
                            display photo. Tap a photo to open the crop and
                            rotate dialog. The life-stage select tags the
                            photo for the optional growth slideshow. */}
                        <p className="text-xs text-slate-400">
                            The first photo is the one shown on cards. Drag to reorder, tap a photo to crop or rotate,
                            and tag a life stage to include it in the growth slideshow.
                        </p>
                        <DragDropContext onDragEnd={handleImageDragEnd}>
                            <Droppable droppableId="gecko-images" direction="horizontal">
                                {(droppable) => (
                                    <div
                                        ref={droppable.innerRef}
                                        {...droppable.droppableProps}
                                        className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2"
                                    >
                                        {formData.image_urls.map((url, index) => {
                                            const meta = cropData[url] || {};
                                            const rotation = meta.rotation || 0;
                                            const lifeStage = meta.life_stage || '';
                                            const isPrimary = index === 0;
                                            return (
                                                <Draggable key={url} draggableId={url} index={index} isDragDisabled={isArchived}>
                                                    {(draggable, snapshot) => (
                                                        <div
                                                            ref={draggable.innerRef}
                                                            {...draggable.draggableProps}
                                                            className={`relative rounded border ${
                                                                snapshot.isDragging
                                                                    ? 'border-emerald-500 shadow-2xl'
                                                                    : isPrimary
                                                                        ? 'border-emerald-600/60'
                                                                        : 'border-slate-700'
                                                            } bg-slate-800/40`}
                                                        >
                                                            <div
                                                                className="w-full h-28 sm:h-32 rounded-t overflow-hidden cursor-pointer"
                                                                onClick={() => handleImageCrop(url)}
                                                            >
                                                                <img
                                                                    src={url}
                                                                    alt={`gecko ${index + 1}`}
                                                                    className="w-full h-full object-cover transition-transform"
                                                                    style={{
                                                                        objectPosition: `${meta.x ?? 50}% ${meta.y ?? 50}%`,
                                                                        transform: rotation ? `rotate(${rotation}deg)` : undefined,
                                                                    }}
                                                                />
                                                            </div>

                                                            {/* Top-left: drag handle. Touch-friendly hit area. */}
                                                            {!isArchived && (
                                                                <div
                                                                    {...draggable.dragHandleProps}
                                                                    className="absolute top-1 left-1 h-7 w-7 rounded bg-slate-900/70 backdrop-blur-sm flex items-center justify-center text-slate-300 hover:text-emerald-300 cursor-grab active:cursor-grabbing"
                                                                    title="Drag to reorder"
                                                                    aria-label="Drag to reorder"
                                                                >
                                                                    <GripVertical className="w-4 h-4" />
                                                                </div>
                                                            )}

                                                            {/* Top-right: remove */}
                                                            {!isArchived && (
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="destructive"
                                                                    className="absolute top-1 right-1 h-7 w-7"
                                                                    aria-label={`Remove photo ${index + 1}`}
                                                                    onClick={() => removeImage(url)}
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            )}

                                                            {/* Primary badge / make-primary action */}
                                                            {isPrimary ? (
                                                                <div
                                                                    className="absolute bottom-[5.25rem] left-1 px-1.5 py-0.5 rounded bg-emerald-700/90 text-emerald-50 text-xs font-semibold flex items-center gap-1"
                                                                    title="Primary display photo (shown on cards)"
                                                                >
                                                                    <Star className="w-3 h-3 fill-current" /> Primary
                                                                </div>
                                                            ) : !isArchived ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => makePrimary(url)}
                                                                    className="touch-hit absolute bottom-[5.25rem] left-1 px-1.5 py-0.5 rounded bg-slate-900/70 backdrop-blur-sm text-slate-300 hover:text-emerald-300 text-xs font-medium flex items-center gap-1"
                                                                    title="Make this the primary display photo"
                                                                >
                                                                    <Star className="w-3 h-3" /> Set primary
                                                                </button>
                                                            ) : null}

                                                            {/* Bottom: life-stage and fire-state tags */}
                                                            <div className="px-1.5 py-1.5 space-y-1">
                                                                <select
                                                                    value={lifeStage}
                                                                    onChange={(e) => setLifeStage(url, e.target.value)}
                                                                    disabled={isArchived}
                                                                    className="w-full text-xs bg-slate-800 border border-slate-600 text-slate-200 rounded px-1.5 py-1 disabled:opacity-50"
                                                                    aria-label="Life stage tag"
                                                                >
                                                                    <option value="">No life-stage tag</option>
                                                                    {LIFE_STAGES.map(s => (
                                                                        <option key={s.value} value={s.value}>{s.label}</option>
                                                                    ))}
                                                                </select>
                                                                <select
                                                                    value={photoFireState(cropData, url)}
                                                                    onChange={(e) => setFireState(url, e.target.value)}
                                                                    disabled={isArchived}
                                                                    className="w-full text-xs bg-slate-800 border border-slate-600 text-slate-200 rounded px-1.5 py-1 disabled:opacity-50"
                                                                    aria-label="Fired up or fired down"
                                                                >
                                                                    <option value="">No fire-state tag</option>
                                                                    {FIRE_SLOTS.map(slot => (
                                                                        <option key={slot.id} value={slot.id}>{slot.label}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            );
                                        })}
                                        {droppable.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                        <Button asChild type="button" variant="outline" disabled={isUploadingImage} className="w-full border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-60">
                            <label
                                className="cursor-pointer"
                                onClick={async (event) => {
                                    if (!isNativePlatform() || isUploadingImage) return;
                                    event.preventDefault();
                                    try {
                                        const file = await captureDevicePhoto();
                                        if (file) await handleImageUpload({ target: { files: [file] } });
                                    } catch (err) {
                                        toast({ title: 'Could not open the camera', description: err.message || 'Try again.', variant: 'destructive' });
                                    }
                                }}
                            >
                                {isUploadingImage ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4 mr-2"/> Upload photos
                                    </>
                                )}
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageUpload}
                                    disabled={isUploadingImage}
                                />
                            </label>
                        </Button>

                        {/* Fired-up and fired-down slots. Buyers ask to see
                            both; the listing and passport show them side by
                            side. Upload straight into a slot, or tag any
                            photo below. */}
                        <div className="grid grid-cols-2 gap-2 mb-3" data-fire-slots>
                            {FIRE_SLOTS.map((slot) => {
                                const slotUrl = fireSlotPhotos[slot.id];
                                const slotMeta = slotUrl ? cropData[slotUrl] || {} : {};
                                return (
                                    <div key={slot.id} className="rounded border border-slate-700 bg-slate-800/40 overflow-hidden">
                                        {slotUrl ? (
                                            <div className="relative h-24 sm:h-28">
                                                <img
                                                    src={slotUrl}
                                                    alt={`${formData.name || 'Gecko'} ${slot.label.toLowerCase()}`}
                                                    className="w-full h-full object-cover"
                                                    style={{
                                                        objectPosition: `${slotMeta.x ?? 50}% ${slotMeta.y ?? 50}%`,
                                                        transform: slotMeta.rotation ? `rotate(${slotMeta.rotation}deg)` : undefined,
                                                    }}
                                                />
                                                {!isArchived && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setFireState(slotUrl, '')}
                                                        className="touch-hit absolute top-1 right-1 h-7 w-7 rounded bg-slate-900/70 backdrop-blur-sm flex items-center justify-center text-slate-300 hover:text-red-300"
                                                        title={`Take this photo out of the ${slot.label.toLowerCase()} slot`}
                                                        aria-label={`Clear ${slot.label.toLowerCase()} slot`}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <label
                                                className={`h-24 sm:h-28 flex flex-col items-center justify-center gap-1 text-center px-2 text-slate-400 ${
                                                    isArchived || isUploadingImage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:text-emerald-300 hover:bg-slate-800'
                                                }`}
                                                onClick={async (event) => {
                                                    if (!isNativePlatform() || isArchived || isUploadingImage) return;
                                                    event.preventDefault();
                                                    try {
                                                        const file = await captureDevicePhoto();
                                                        if (file) await handleSlotUpload({ target: { files: [file] } }, slot.id);
                                                    } catch (err) {
                                                        toast({ title: 'Could not open the camera', description: err.message || 'Try again.', variant: 'destructive' });
                                                    }
                                                }}
                                            >
                                                <Upload className="w-4 h-4" />
                                                <span className="text-xs">Add {slot.label.toLowerCase()} photo</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => handleSlotUpload(e, slot.id)}
                                                    disabled={isArchived || isUploadingImage}
                                                />
                                            </label>
                                        )}
                                        <div className="px-2 py-1.5 border-t border-slate-700">
                                            <p className="text-xs font-semibold text-slate-200">{slot.label}</p>
                                            <p className="text-xs leading-snug text-slate-500">{slot.hint}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Growth Slideshow toggle. Only shows when at least
                            one photo carries a life-stage tag, since the
                            slideshow has nothing to show without tags. */}
                        {formData.image_urls.some(u => cropData[u]?.life_stage) && (
                            <div className="flex items-center justify-between p-3 mt-3 bg-slate-800/60 rounded-lg border border-slate-700">
                                <div className="flex items-center gap-2">
                                    <Camera className="w-4 h-4 text-emerald-400" />
                                    <div>
                                        <Label className="text-sm text-slate-200">Growth slideshow</Label>
                                        <p className="text-xs text-slate-500">Show tagged photos as a life-stage slideshow on the detail view.</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={!!formData.growth_slideshow_enabled}
                                    onCheckedChange={(checked) => handleChange('growth_slideshow_enabled', checked)}
                                    disabled={isArchived}
                                />
                            </div>
                        )}

                        {/* The drawing a card shows while the gecko has no
                            photo. Folded away so it does not push the rest
                            of the form down. */}
                        <div data-no-dirty>
                            <button
                                type="button"
                                onClick={() => setArtworkOpen((open) => !open)}
                                aria-expanded={artworkOpen}
                                aria-controls="gecko-form-artwork"
                                className="touch:min-h-11 inline-flex flex-wrap items-center gap-x-1.5 text-left text-sm font-medium text-emerald-300 hover:text-emerald-200"
                            >
                                <ChevronDown className={`h-4 w-4 transition-transform ${artworkOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                                Placeholder artwork
                                <span className="font-normal text-slate-400">shown while there is no photo</span>
                            </button>
                        </div>
                        {artworkOpen && (
                            <div id="gecko-form-artwork">
                                <GeckoArtworkPicker
                                    gecko={{ ...gecko, ...formData, inherited_placeholder_style: gecko?.id
                                        ? gecko.inherited_placeholder_style
                                        : currentUser?.gecko_artwork_style }}
                                    onChange={style => handleChange('placeholder_style', style)}
                                    disabled={isArchived || isSaving}
                                />
                            </div>
                        )}
                    </FormSection>

                    <FormSection id="identity" title="Identity" summary={sectionSummary.identity} open={openSections.identity} onToggle={() => toggleSection('identity')}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                 <Label htmlFor="name">Name *</Label>
                                 <Input id="name" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} required disabled={isArchived} className="bg-slate-800 border-slate-600 text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed" />
                             </div>
                            <div>
                                 <Label htmlFor="gecko_id_code">ID code</Label>
                                 <Input id="gecko_id_code" value={formData.gecko_id_code} onChange={(e) => handleChange('gecko_id_code', e.target.value)} disabled={isArchived} className="bg-slate-800 border-slate-600 text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed" />
                             </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="sex">Sex *</Label>
                                <Select value={formData.sex} onValueChange={(v) => handleChange('sex', v)} disabled={isArchived}>
                                    <SelectTrigger aria-label="Sex" className="h-10 bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-600 text-slate-100 z-[99999]">
                                        <SelectItem value="Unsexed" className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">Unsexed</SelectItem>
                                        <SelectItem value="Male" className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">Male</SelectItem>
                                        <SelectItem value="Female" className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">Female</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* One labelled row. A full date pasted (or
                                autofilled) into Year or Day fills all three
                                (experience review D7). */}
                            <div className="min-w-0">
                                <Label id="hatch_date_label" htmlFor="hatch_year">Hatch date</Label>
                                <div role="group" aria-labelledby="hatch_date_label" className="grid grid-cols-[minmax(0,4fr)_minmax(0,6fr)_minmax(0,3fr)] gap-2 [&>input]:h-10">
                                    <Input
                                        id="hatch_year"
                                        inputMode="numeric"
                                        placeholder="Year"
                                        aria-label="Hatch year"
                                        aria-describedby="hatch_date_hint"
                                        autoComplete="off"
                                        value={hatchYear}
                                        onChange={(e) => handleHatchBox(e.target.value, setHatchYear, 4)}
                                        onPaste={handleHatchPaste}
                                        disabled={isArchived}
                                        className="bg-slate-800 border-slate-600 text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <Select value={hatchMonth} onValueChange={(v) => setHatchMonth(v === 'none' ? '' : v)} disabled={isArchived}>
                                        <SelectTrigger aria-label="Hatch month" className="h-10 touch:h-11 bg-slate-800 border-slate-600 text-slate-100">
                                            <SelectValue placeholder="Month" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-600 text-slate-100 z-[99999]">
                                            <SelectItem value="none" className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">No month</SelectItem>
                                            {MONTHS.map(m => (
                                                <SelectItem key={m.value} value={m.value} className="text-slate-100 focus:bg-slate-700 focus:text-white hover:bg-slate-700">{m.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        id="hatch_day"
                                        inputMode="numeric"
                                        placeholder="Day"
                                        aria-label="Hatch day"
                                        aria-describedby="hatch_date_hint"
                                        autoComplete="off"
                                        value={hatchDay}
                                        onChange={(e) => handleHatchBox(e.target.value, setHatchDay, 2)}
                                        onPaste={handleHatchPaste}
                                        disabled={isArchived}
                                        className="bg-slate-800 border-slate-600 text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                </div>
                                <p id="hatch_date_hint" aria-live="polite" className={`mt-1.5 text-xs ${hatchStatus === 'invalid' ? 'text-amber-300' : 'text-slate-400'}`}>
                                    {hatchStatus === 'complete' && `Hatched ${format(hatchDateNow, 'MMMM d, yyyy')}.`}
                                    {hatchStatus === 'invalid' && `That day does not exist. Check the month and the day.${hatchYearKept ? ` Until then, only ${hatchYearKept} is saved.` : ''}`}
                                    {hatchStatus === 'partial' && (hatchYearKept
                                        ? `Saved as hatched in ${hatchYearKept}. ${hatchMonth && !hatchDay ? 'The month is kept once you add the day.' : hatchDay && !hatchMonth ? 'The day is kept once you add the month.' : 'Add the month and day when you know them.'}`
                                        : 'A hatch date needs a four-digit year, such as 2025.')}
                                    {hatchStatus === 'empty' && 'You can paste a full date, such as 24 Feb 2026, into Year.'}
                                </p>
                            </div>
                        </div>
                    </FormSection>

                    <FormSection id="parents" title="Parents" summary={sectionSummary.parents} open={openSections.parents} onToggle={() => toggleSection('parents')}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ParentAutocomplete
                                id="sire_input"
                                label="Sire (father)"
                                placeholder="Type or browse males..."
                                value={sireInput}
                                onChange={handleSireInputChange}
                                onSelect={(s) => {
                                    setSireInput(`${s.name} (${s.gecko_id_code || 'No ID'})`);
                                    setSireId(s.id);
                                }}
                                geckos={userGeckos.filter((g) => g.sex === 'Male' && g.id !== gecko?.id && !g.archived && !g.notes?.startsWith('[Manual sale]'))}
                                disabled={isArchived}
                            />
                            <ParentAutocomplete
                                id="dam_input"
                                label="Dam (mother)"
                                placeholder="Type or browse females..."
                                value={damInput}
                                onChange={handleDamInputChange}
                                onSelect={(d) => {
                                    setDamInput(`${d.name} (${d.gecko_id_code || 'No ID'})`);
                                    setDamId(d.id);
                                }}
                                geckos={userGeckos.filter((g) => g.sex === 'Female' && g.id !== gecko?.id && !g.archived && !g.notes?.startsWith('[Manual sale]'))}
                                disabled={isArchived}
                            />
                        </div>
                    </FormSection>

                    <FormSection id="morph" title="Morph and quality" summary={sectionSummary.morph} open={openSections.morph} onToggle={() => toggleSection('morph')}>
                        {/* One group for the morph: tags from the catalogue
                            and the free-text line (experience review D4). */}
                        <MorphIDSelector
                            selectedMorphs={formData.morph_tags || []}
                            onMorphsChange={(tags) => handleChange('morph_tags', tags)}
                            freeText={formData.morphs_traits}
                            onFreeTextChange={(text) => handleChange('morphs_traits', text)}
                            disabled={isArchived}
                        />

                        {/* Quality grade (Geck Inspect Standard 0-10). Tier
                            is derived; pattern_grade is mirrored on save. */}
                        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
                            <QualityInput
                                value={formData.quality_score}
                                onChange={(score) => handleChange('quality_score', score)}
                            />
                        </div>

                        {/* Tail status. Crested geckos drop tails readily and
                            don't regrow them, so "Regenerating" is hidden for
                            them; other species (leopard, gargoyle, leachie,
                            etc.) can regrow tails so the option shows. */}
                        <div>
                            <Label>Tail status</Label>
                            <div className={`grid gap-2 mt-1 ${(formData.species || 'Crested Gecko') === 'Crested Gecko' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                {[
                                    { value: 'intact',       label: 'Intact',       desc: 'Original tail' },
                                    { value: 'dropped',      label: 'Dropped',      desc: 'Caudal autotomy' },
                                    { value: 'regenerating', label: 'Regenerating', desc: 'Partial regrowth', hideFor: ['Crested Gecko'] },
                                ]
                                    .filter(opt => !opt.hideFor?.includes(formData.species || 'Crested Gecko'))
                                    .map(opt => {
                                        const active = formData.tail_status === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => handleChange('tail_status', active ? null : opt.value)}
                                                disabled={isArchived}
                                                title={opt.desc}
                                                className={`touch:min-h-11 px-2 py-2 rounded-lg border text-xs font-medium transition-colors ${
                                                    active
                                                        ? 'border-emerald-500 bg-emerald-900/40 text-emerald-200'
                                                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                            >
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                            </div>
                        </div>
                    </FormSection>

                    <FormSection id="selling" title="Selling and visibility" summary={sectionSummary.selling} open={openSections.selling} onToggle={() => toggleSection('selling')}>
                        {/* For Sale Toggle */}
                        <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
                            <div className="flex-1">
                                <Label className="text-base font-medium flex items-center gap-2">
                                    <DollarSign className="w-5 h-5 text-yellow-600" />
                                    List for sale
                                </Label>
                                <p className="text-sm text-muted-foreground mt-1">Makes the gecko visible on the marketplace.</p>
                            </div>
                            <Switch
                                 checked={isForSale}
                                 onCheckedChange={handleForSaleToggle}
                                 disabled={isArchived}
                                 className="data-[state=checked]:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                             />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="asking_price">Asking price ($)</Label>
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
                            <div>
                                <Label htmlFor="status">Status</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(v) => {
                                        // A saved gecko marked Sold goes through the
                                        // archive dialog, which asks for the sale
                                        // price so Business Tools records the sale
                                        // and the gecko leaves the active count.
                                        if (v === 'Sold' && gecko?.id && onMarkSold) {
                                            onMarkSold(gecko.id);
                                            return;
                                        }
                                        handleChange('status', v);
                                    }}
                                    disabled={isForSale || isArchived}
                                >
                                    <SelectTrigger aria-label="Status" className="h-10 bg-slate-800 border-slate-600 text-slate-100"><SelectValue /></SelectTrigger>
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
                        </div>

                        <div>
                            <Label htmlFor="marketplace_description">Marketplace description</Label>
                            <Textarea
                                id="marketplace_description"
                                value={formData.marketplace_description}
                                onChange={(e) => handleChange('marketplace_description', e.target.value)}
                                disabled={isArchived}
                                placeholder="What buyers read on your listing. Uses Notes if left blank."
                                rows={3}
                                className="bg-slate-800 border-slate-600 text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>

                        {/* Public Display Toggle */}
                        <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
                            <div>
                                <Label htmlFor="is_public" className="text-base">Public display</Label>
                                <p className="text-xs text-slate-400">Show in public profile and marketplace</p>
                            </div>
                            <Switch
                                 id="is_public"
                                 checked={formData.is_public === true}
                                 onCheckedChange={(checked) => {
                                     if (!checked && gecko?.passport_code && gecko?.is_public) {
                                         setConfirmPrivate(true);
                                         return;
                                     }
                                     setFormData(prev => ({ ...prev, is_public: checked, gallery_display: checked && prev.gallery_display }));
                                 }}
                                 disabled={isArchived}
                                 className="disabled:opacity-50 disabled:cursor-not-allowed"
                             />
                        </div>

                        {/* Gallery Display Toggle */}
                        <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
                            <div>
                                <Label htmlFor="gallery_display" className="text-base">Gallery display</Label>
                                <p className="text-xs text-slate-400">Show in public gallery</p>
                            </div>
                            <Switch
                                 id="gallery_display"
                                 checked={formData.is_public === true && formData.gallery_display === true}
                                 onCheckedChange={(checked) => handleChange('gallery_display', checked)}
                                 disabled={isArchived || formData.is_public !== true}
                                 className="disabled:opacity-50 disabled:cursor-not-allowed"
                             />
                        </div>

                        {/* Gravid, Female only */}
                        {formData.sex === 'Female' && (
                            <div className="space-y-3 p-4 bg-slate-800 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-base">Gravid</Label>
                                        <p className="text-xs text-slate-400 mt-0.5">Switch on while this female is carrying eggs</p>
                                    </div>
                                    <Switch
                                        checked={formData.is_gravid || false}
                                        onCheckedChange={(checked) => handleChange('is_gravid', checked)}
                                        disabled={isArchived}
                                        aria-label="Gravid"
                                        className="disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                </div>
                                {formData.is_gravid && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                        <div>
                                            <Label className="text-sm text-slate-300">Gravid since</Label>
                                            <Input
                                                type="date"
                                                value={formData.gravid_since || ''}
                                                onChange={(e) => handleChange('gravid_since', e.target.value)}
                                                disabled={isArchived}
                                                className="bg-slate-800 border-slate-600 text-slate-100 mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-sm text-slate-300">Expected or actual egg drop date</Label>
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

                        {/* Collection picker, only renders when the user has more
                            than one writable collection. Solo-collection users
                            don't need a chooser; their default lands every gecko
                            in the right place via the trigger. Only the gecko's
                            owner may move it (the database refuses anyone else),
                            so a collection editor never sees the picker on
                            someone else's gecko. */}
                        {writableCollections.length > 1 && isOwnGecko && (
                            <div>
                                <Label htmlFor="collection_id">Collection</Label>
                                <Select
                                    value={formData.collection_id || ''}
                                    onValueChange={(v) => handleChange('collection_id', v)}
                                    disabled={isArchived}
                                >
                                    <SelectTrigger aria-label="Collection" className="h-10 bg-slate-800 border-slate-600 text-slate-100">
                                        <SelectValue placeholder="Default collection" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-600 text-slate-100 z-[99999]">
                                        {writableCollections.map((c) => (
                                            <SelectItem
                                                key={c.id}
                                                value={c.id}
                                                className="text-slate-100 focus:bg-slate-700 focus:text-white"
                                            >
                                                {c.name}{c.is_default ? ' (default)' : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-slate-500 mt-1">
                                    Move this gecko to a different collection. Manage collections in Settings.
                                </p>
                            </div>
                        )}
                    </FormSection>

                    <FormSection id="care" title="Care and notes" summary={sectionSummary.care} open={openSections.care} onToggle={() => toggleSection('care')}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="weight_grams">Current weight (grams)</Label>
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
                            {/* Feeding Group */}
                            <div>
                                <Label>Feeding group</Label>
                                <Select value={formData.feeding_group_id || 'none'} onValueChange={(v) => handleChange('feeding_group_id', v === 'none' ? null : v)} disabled={isArchived}>
                                    <SelectTrigger aria-label="Feeding group" className="h-10 bg-slate-800 border-slate-600 text-slate-100">
                                        <SelectValue placeholder="No group assigned" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 border-slate-600 text-slate-100 z-[99999]">
                                        <SelectItem value="none" className="text-slate-100 focus:bg-slate-700 focus:text-white">No group</SelectItem>
                                        {feedingGroups.map(g => (
                                            <SelectItem key={g.id} value={g.id} className="text-slate-100 focus:bg-slate-700 focus:text-white">
                                                Group {g.label}{g.name ? `: ${g.name}` : ''} ({g.diet_type})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {feedingGroups.length === 0 && (
                                    <p className="text-xs text-slate-500 mt-1">Create feeding groups in the Season Planner.</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea id="notes" value={formData.notes} onChange={(e) => handleChange('notes', e.target.value)} disabled={isArchived} className="bg-slate-800 border-slate-600 text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed" />
                        </div>
                    </FormSection>
                    </div>

                    {/* Certificates live on the gecko record rather than the
                        edit form, see src/components/gecko/record. */}
                </form>

                <CardFooter className="flex-shrink-0 mt-auto bg-slate-900 border-t border-slate-700 p-3 sm:p-4 flex flex-wrap justify-end items-center gap-2 sm:gap-3">
                    {/* Only a saved gecko can be archived; a draft has no id. */}
                    {gecko?.id && onArchive && !isArchived && (
                        <Button
                            type="button"
                            variant="outline"
                            aria-label="Archive"
                            onClick={() => onArchive(gecko.id, true)}
                            className="h-10 px-3 sm:px-4 border-red-600 text-red-400 hover:bg-red-950/40 hover:text-red-300 mr-auto"
                        >
                            <Archive className="w-4 h-4 sm:mr-2" />
                            <span className="hidden sm:inline">Archive</span>
                        </Button>
                    )}
                    {isArchived && (
                        <div className="h-10 px-4 rounded border border-slate-600 bg-slate-800 flex items-center text-slate-400 text-sm font-medium cursor-not-allowed mr-auto">
                            Archived
                        </div>
                    )}
                    <Button variant="outline" onClick={requestClose} disabled={isSaving} className="h-10 px-3 sm:px-4 border-slate-600 text-slate-300 hover:bg-slate-800">Cancel</Button>
                    <Button type="submit" form="gecko-details-form" onClick={revealInvalidFields} disabled={isSaving || isArchived} className="bg-emerald-600 hover:bg-emerald-700 h-10 px-3 sm:px-4">
                        {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {getSaveButtonText()}
                    </Button>
                </CardFooter>


            {/* Image Crop Dialog */}
            {cropDialogOpen && currentImage && (
                <ImageCropDialog
                    imageUrl={currentImage}
                    initialCrop={cropData[currentImage]}
                    onSave={(cropInfo) => saveCropData(currentImage, cropInfo)}
                    onClose={() => setCropDialogOpen(false)}
                />
            )}

            {/* A passport link and its printed QR labels only work while the
                gecko is public, so warn before switching one to private. */}
            <AlertDialog open={confirmPrivate} onOpenChange={setConfirmPrivate}>
                <AlertDialogContent className="bg-slate-900 border-slate-700">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-slate-100">Make {formData.name || 'this gecko'} private?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                            This gecko has a passport ({gecko?.passport_code}). While it is private, the passport
                            link and any printed QR labels show &ldquo;Private passport&rdquo; to everyone but you.
                            Switch it back to public to make them work again.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-slate-600">Keep it public</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={() => setFormData(prev => ({ ...prev, is_public: false, gallery_display: false }))}
                        >
                            Make private
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
                <AlertDialogContent className="bg-slate-900 border-slate-700">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-slate-100">Discard your changes?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                            What you entered here, and any photos you added, have not been saved.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-slate-600">Keep editing</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-700 hover:bg-red-600 text-white"
                            onClick={() => {
                                setConfirmDiscard(false);
                                // Discarded on purpose: the kept draft goes too.
                                draftDoneRef.current = true;
                                if (keepsDraft) clearGeckoFormDraft(currentUser);
                                onCancel();
                            }}
                        >
                            Discard
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            </DialogContent>
        </Dialog>
    );
}

// ImageCropDialog moved to ./form/ImageCropDialog.jsx
