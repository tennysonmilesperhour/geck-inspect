import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { X, Plus, Save } from 'lucide-react';

const OFFER_TYPES = [
    { value: 'mentorship', label: 'Mentorship (ongoing)' },
    { value: 'consult', label: 'Consult (one-off session)' },
    { value: 'course', label: 'Course (structured curriculum)' },
];

// Quick-add suggestions so mentors describe their lane in the terms the
// community actually searches for.
const SPECIALTY_SUGGESTIONS = [
    'Lilly White lines',
    'Axanthic projects',
    'Structure judging',
    'Cappuccino genetics',
    'Phantom and Sable lines',
    'Incubation and hatchling care',
    'Pairing strategy',
    'Bioactive husbandry',
];

const EMPTY_FORM = {
    headline: '',
    offer_type: '',
    specialties: [],
    years_experience: '',
    price_usd: '',
    price_note: '',
    duration_minutes: '',
    availability_note: '',
    bio_md: '',
    is_active: true,
};

function formFromOffer(offer) {
    if (!offer) return { ...EMPTY_FORM };
    return {
        headline: offer.headline || '',
        offer_type: offer.offer_type || '',
        specialties: Array.isArray(offer.specialties) ? [...offer.specialties] : [],
        years_experience: offer.years_experience ?? '',
        price_usd: offer.price_usd ?? '',
        price_note: offer.price_note || '',
        duration_minutes: offer.duration_minutes ?? '',
        availability_note: offer.availability_note || '',
        bio_md: offer.bio_md || '',
        is_active: offer.is_active !== false,
    };
}

// Empty string -> null, otherwise a finite number. Keeps numeric columns
// clean instead of writing "" into integer/numeric fields.
function toNumberOrNull(value) {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/**
 * Create/edit dialog for a mentor offer. Writes straight to the
 * mentor_offers table (no TABLE_MAP entity exists for it). On create,
 * user_id is the real auth uid from supabase.auth.getUser(), NOT the
 * legacy profiles.id, per the AuthContext note about uuid columns.
 */
export default function MentorOfferEditor({ open, onOpenChange, offer = null, onSaved }) {
    const { toast } = useToast();
    const [form, setForm] = useState(EMPTY_FORM);
    const [specialtyInput, setSpecialtyInput] = useState('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const isEditing = Boolean(offer?.id);

    // Re-seed the form every time the dialog opens (or the target offer
    // changes) so a previous session's draft never leaks into a new one.
    useEffect(() => {
        if (open) {
            setForm(formFromOffer(offer));
            setSpecialtyInput('');
            setError('');
        }
    }, [open, offer]);

    const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const addSpecialty = (raw) => {
        const value = (raw ?? specialtyInput).trim();
        if (!value) return;
        setForm((prev) =>
            prev.specialties.some((s) => s.toLowerCase() === value.toLowerCase())
                ? prev
                : { ...prev, specialties: [...prev.specialties, value] }
        );
        setSpecialtyInput('');
    };

    const removeSpecialty = (value) => {
        setForm((prev) => ({
            ...prev,
            specialties: prev.specialties.filter((s) => s !== value),
        }));
    };

    const handleSave = async () => {
        if (!form.headline.trim()) {
            setError('Add a headline so keepers know what you offer.');
            return;
        }
        if (!form.offer_type) {
            setError('Pick an offer type: mentorship, consult, or course.');
            return;
        }
        setError('');
        setIsSaving(true);
        try {
            const payload = {
                headline: form.headline.trim(),
                offer_type: form.offer_type,
                specialties: form.specialties,
                years_experience: toNumberOrNull(form.years_experience),
                price_usd: toNumberOrNull(form.price_usd),
                price_note: form.price_note.trim() || null,
                duration_minutes: toNumberOrNull(form.duration_minutes),
                availability_note: form.availability_note.trim() || null,
                bio_md: form.bio_md.trim() || null,
                is_active: form.is_active,
            };

            if (isEditing) {
                const { error: updateError } = await supabase
                    .from('mentor_offers')
                    .update(payload)
                    .eq('id', offer.id);
                if (updateError) throw updateError;
            } else {
                const { data: authData, error: authError } = await supabase.auth.getUser();
                if (authError) throw authError;
                const authUser = authData?.user;
                if (!authUser) {
                    throw new Error('You need to be signed in to offer mentorship.');
                }
                const { error: insertError } = await supabase
                    .from('mentor_offers')
                    .insert({
                        ...payload,
                        user_id: authUser.id,
                        owner_email: authUser.email,
                        contact_method: 'in_app_messages',
                    });
                if (insertError) throw insertError;
            }

            toast({
                title: isEditing ? 'Offer updated' : 'Offer published',
                description: isEditing
                    ? 'Your changes are live.'
                    : 'Keepers can now find you on the Mentorship page.',
            });
            onOpenChange(false);
            onSaved?.();
        } catch (err) {
            console.error('Failed to save mentor offer:', err);
            setError(err.message || 'Could not save the offer. Please try again.');
        }
        setIsSaving(false);
    };

    const remainingSuggestions = SPECIALTY_SUGGESTIONS.filter(
        (s) => !form.specialties.some((have) => have.toLowerCase() === s.toLowerCase())
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? 'Edit your offer' : 'Offer mentorship'}
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Keepers reach out through in-app messages. Sessions and
                        payment are arranged directly between you; Geck Inspect
                        does not process mentorship payments yet.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <Label className="text-slate-300 text-sm mb-1 block">
                            Headline <span className="text-red-400">*</span>
                        </Label>
                        <Input
                            value={form.headline}
                            onChange={(e) => setField('headline', e.target.value)}
                            placeholder="e.g. Lilly White pairing strategy, from selection to hatchlings"
                            maxLength={120}
                            className="bg-slate-950 border-slate-700 text-slate-100"
                        />
                    </div>

                    <div>
                        <Label className="text-slate-300 text-sm mb-1 block">
                            Offer type <span className="text-red-400">*</span>
                        </Label>
                        <Select
                            value={form.offer_type}
                            onValueChange={(v) => setField('offer_type', v)}
                        >
                            <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                                <SelectValue placeholder="Pick a format" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                                {OFFER_TYPES.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                        {t.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label className="text-slate-300 text-sm mb-1 block">Specialties</Label>
                        {form.specialties.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {form.specialties.map((s) => (
                                    <Badge
                                        key={s}
                                        variant="secondary"
                                        className="bg-slate-800 text-slate-200 border-slate-700 pr-1"
                                    >
                                        {s}
                                        <button
                                            type="button"
                                            onClick={() => removeSpecialty(s)}
                                            aria-label={`Remove ${s}`}
                                            className="ml-1 p-0.5 rounded hover:bg-slate-700"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Input
                                value={specialtyInput}
                                onChange={(e) => setSpecialtyInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addSpecialty();
                                    }
                                }}
                                placeholder="Add a specialty and press Enter"
                                className="bg-slate-950 border-slate-700 text-slate-100"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => addSpecialty()}
                                disabled={!specialtyInput.trim()}
                                className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0"
                            >
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>
                        {remainingSuggestions.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {remainingSuggestions.map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => addSpecialty(s)}
                                        className="text-[11px] px-2 py-0.5 rounded-full border border-slate-700 text-slate-400 hover:border-emerald-600 hover:text-emerald-300 transition-colors"
                                    >
                                        + {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-slate-300 text-sm mb-1 block">
                                Years breeding
                            </Label>
                            <Input
                                type="number"
                                min="0"
                                value={form.years_experience}
                                onChange={(e) => setField('years_experience', e.target.value)}
                                placeholder="e.g. 8"
                                className="bg-slate-950 border-slate-700 text-slate-100"
                            />
                        </div>
                        <div>
                            <Label className="text-slate-300 text-sm mb-1 block">
                                Session length (minutes)
                            </Label>
                            <Input
                                type="number"
                                min="0"
                                value={form.duration_minutes}
                                onChange={(e) => setField('duration_minutes', e.target.value)}
                                placeholder="e.g. 45"
                                className="bg-slate-950 border-slate-700 text-slate-100"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-slate-300 text-sm mb-1 block">
                                Price (USD)
                            </Label>
                            <Input
                                type="number"
                                min="0"
                                step="1"
                                value={form.price_usd}
                                onChange={(e) => setField('price_usd', e.target.value)}
                                placeholder="e.g. 60"
                                className="bg-slate-950 border-slate-700 text-slate-100"
                            />
                        </div>
                        <div>
                            <Label className="text-slate-300 text-sm mb-1 block">
                                Price note
                            </Label>
                            <Input
                                value={form.price_note}
                                onChange={(e) => setField('price_note', e.target.value)}
                                placeholder="e.g. First chat free"
                                className="bg-slate-950 border-slate-700 text-slate-100"
                            />
                        </div>
                    </div>

                    <div>
                        <Label className="text-slate-300 text-sm mb-1 block">Availability</Label>
                        <Input
                            value={form.availability_note}
                            onChange={(e) => setField('availability_note', e.target.value)}
                            placeholder="e.g. Weekday evenings, US Eastern"
                            className="bg-slate-950 border-slate-700 text-slate-100"
                        />
                    </div>

                    <div>
                        <Label className="text-slate-300 text-sm mb-1 block">About you</Label>
                        <Textarea
                            value={form.bio_md}
                            onChange={(e) => setField('bio_md', e.target.value)}
                            placeholder="Your breeding background, the projects you have run, and what a keeper gets out of working with you."
                            rows={5}
                            className="bg-slate-950 border-slate-700 text-slate-100 resize-y"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">Markdown is supported.</p>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5">
                        <div>
                            <Label className="text-slate-200 text-sm">Active</Label>
                            <p className="text-[11px] text-slate-500">
                                Active offers are visible to everyone on the Mentorship page.
                            </p>
                        </div>
                        <Switch
                            checked={form.is_active}
                            onCheckedChange={(v) => setField('is_active', v)}
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-red-400" role="alert">
                            {error}
                        </p>
                    )}

                    <div className="flex gap-2 pt-1">
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {isSaving
                                ? 'Saving...'
                                : isEditing
                                    ? 'Save changes'
                                    : 'Publish offer'}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
