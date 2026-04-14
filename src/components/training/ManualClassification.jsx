import { useState } from 'react';
import { GeckoImage, User } from '@/entities/all';
import { UploadFile } from '@/integrations/Core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const MORPH_OPTIONS = [
    "flame", "harlequin", "extreme_harlequin", "pinstripe", "phantom_pinstripe",
    "tiger", "brindle", "extreme_brindle", "dalmatian", "super_dalmatian",
    "patternless", "bicolor", "tricolor", "lilly_white", "axanthic",
    "cappuccino", "frappuccino", "hypo", "translucent", "moonglow"
];

const BASE_COLOR_OPTIONS = [
    "red", "dark_red", "bright_red", "yellow", "bright_yellow", "pale_yellow",
    "orange", "peach", "cream", "white", "brown", "dark_brown", "tan",
    "olive", "dark_olive", "buckskin", "chocolate", "lavender", "purple"
];

const SECONDARY_TRAITS = [
    "super_stripe", "partial_pinstripe", "dashed_pinstripe", "reverse_pinstripe",
    "phantom", "fired_up", "fired_down", "dalmatian_spots", "super_spots",
    "ink_spots", "oil_spots", "red_spots", "portholes", "kneecaps"
];

export default function ManualClassification() {
    const [_uploadedImage, setUploadedImage] = useState(null);
    const [imageUrl, setImageUrl] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        primary_morph: '',
        secondary_morph: '',
        secondary_traits: [],
        base_color: '',
        pattern_intensity: 'medium',
        white_amount: 'medium',
        notes: '',
        age_estimate: 'unknown',
        fired_state: 'unknown'
    });

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const { file_url } = await UploadFile({ file });
            setImageUrl(file_url);
            setUploadedImage(file);
            toast({ title: "Image uploaded", description: "Now classify the gecko's traits" });
        } catch (error) {
            console.error("Upload failed:", error);
            toast({ title: "Upload failed", description: error.message, variant: "destructive" });
        }
        setIsUploading(false);
    };

    const handleTraitToggle = (trait) => {
        const currentTraits = formData.secondary_traits || [];
        if (currentTraits.includes(trait)) {
            setFormData({
                ...formData,
                secondary_traits: currentTraits.filter(t => t !== trait)
            });
        } else {
            setFormData({
                ...formData,
                secondary_traits: [...currentTraits, trait]
            });
        }
    };

    const handleSubmit = async () => {
        if (!imageUrl || !formData.primary_morph) {
            toast({ title: "Missing data", description: "Please upload an image and select a primary morph", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        try {
            const user = await User.me();
            
            await GeckoImage.create({
                image_url: imageUrl,
                user_id: user.id,
                primary_morph: formData.primary_morph,
                secondary_morph: formData.secondary_morph || null,
                secondary_traits: formData.secondary_traits,
                base_color: formData.base_color,
                pattern_intensity: formData.pattern_intensity,
                white_amount: formData.white_amount,
                notes: formData.notes,
                age_estimate: formData.age_estimate,
                fired_state: formData.fired_state,
                verified: false
            });

            toast({ title: "Success!", description: "Training data submitted successfully" });
            
            // Reset form
            setUploadedImage(null);
            setImageUrl(null);
            setFormData({
                primary_morph: '',
                secondary_morph: '',
                secondary_traits: [],
                base_color: '',
                pattern_intensity: 'medium',
                white_amount: 'medium',
                notes: '',
                age_estimate: 'unknown',
                fired_state: 'unknown'
            });
        } catch (error) {
            console.error("Failed to save:", error);
            toast({ title: "Save failed", description: error.message, variant: "destructive" });
        }
        setIsSaving(false);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-slate-100">Upload Gecko Image</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label className="text-slate-300">Select Image</Label>
                        <Input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={isUploading}
                            className="bg-slate-800 border-slate-600"
                        />
                    </div>

                    {isUploading && (
                        <div className="flex items-center gap-2 text-emerald-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Uploading...</span>
                        </div>
                    )}

                    {imageUrl && (
                        <div className="mt-4">
                            <img
                                src={imageUrl}
                                alt="Uploaded gecko"
                                className="w-full rounded-lg border-2 border-slate-700"
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-slate-100">Classify Traits</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label className="text-slate-300">Primary Morph *</Label>
                        <Select
                            value={formData.primary_morph}
                            onValueChange={(value) => setFormData({ ...formData, primary_morph: value })}
                        >
                            <SelectTrigger className="bg-slate-800 border-slate-600">
                                <SelectValue placeholder="Select primary morph" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600 max-h-60">
                                {MORPH_OPTIONS.map(morph => (
                                    <SelectItem key={morph} value={morph}>
                                        {morph.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label className="text-slate-300">Base Color</Label>
                        <Select
                            value={formData.base_color}
                            onValueChange={(value) => setFormData({ ...formData, base_color: value })}
                        >
                            <SelectTrigger className="bg-slate-800 border-slate-600">
                                <SelectValue placeholder="Select base color" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600 max-h-60">
                                {BASE_COLOR_OPTIONS.map(color => (
                                    <SelectItem key={color} value={color}>
                                        {color.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label className="text-slate-300">Secondary Traits</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {SECONDARY_TRAITS.map(trait => (
                                <button
                                    key={trait}
                                    type="button"
                                    onClick={() => handleTraitToggle(trait)}
                                    className={`px-3 py-1 rounded-full text-xs transition-colors ${
                                        formData.secondary_traits?.includes(trait)
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                                >
                                    {trait.replace(/_/g, ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-slate-300">Pattern Intensity</Label>
                            <Select
                                value={formData.pattern_intensity}
                                onValueChange={(value) => setFormData({ ...formData, pattern_intensity: value })}
                            >
                                <SelectTrigger className="bg-slate-800 border-slate-600">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-600">
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="extreme">Extreme</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label className="text-slate-300">White Amount</Label>
                            <Select
                                value={formData.white_amount}
                                onValueChange={(value) => setFormData({ ...formData, white_amount: value })}
                            >
                                <SelectTrigger className="bg-slate-800 border-slate-600">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-600">
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="extreme">Extreme</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label className="text-slate-300">Notes</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Additional observations..."
                            className="bg-slate-800 border-slate-600"
                        />
                    </div>

                    <Button
                        onClick={handleSubmit}
                        disabled={!imageUrl || !formData.primary_morph || isSaving}
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Submit Training Data
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}