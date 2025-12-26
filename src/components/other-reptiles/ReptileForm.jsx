import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { OtherReptile } from '@/entities/all';
import { UploadFile } from '@/integrations/Core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Upload, X, Loader2, Trash2, Bell, Mail, Archive } from 'lucide-react';
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

export default function ReptileForm({ reptile, onSubmit, onCancel, onDelete, onArchive }) {
    const [formData, setFormData] = useState({
        name: '',
        species: '',
        morph: '',
        sex: 'Unsexed',
        birth_date: '',
        notes: '',
        image_urls: [],
        feeding_reminder_enabled: false,
        feeding_interval_days: 7,
        last_fed_date: '',
        feeding_notification_enabled: false,
        feeding_email_enabled: false,
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (reptile) {
            setFormData({
                name: reptile.name || '',
                species: reptile.species || '',
                morph: reptile.morph || '',
                sex: reptile.sex || 'Unsexed',
                birth_date: reptile.birth_date || '',
                notes: reptile.notes || '',
                image_urls: reptile.image_urls || [],
                feeding_reminder_enabled: reptile.feeding_reminder_enabled || false,
                feeding_interval_days: reptile.feeding_interval_days || 7,
                last_fed_date: reptile.last_fed_date || '',
                feeding_notification_enabled: reptile.feeding_notification_enabled || false,
                feeding_email_enabled: reptile.feeding_email_enabled || false,
            });
        }
    }, [reptile]);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        setIsSaving(true);
        const urls = [...formData.image_urls];

        try {
            for (const file of files) {
                const { file_url } = await UploadFile({ file });
                urls.push(file_url);
            }
            setFormData(prev => ({ ...prev, image_urls: urls }));
        } catch (err) {
            console.error("Image upload failed", err);
        }
        
        setIsSaving(false);
    };

    const removeImage = (urlToRemove) => {
        setFormData(prev => ({ 
            ...prev, 
            image_urls: prev.image_urls.filter(url => url !== urlToRemove)
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        
        try {
            const dataToSave = {
                ...formData,
                feeding_interval_days: parseInt(formData.feeding_interval_days) || 7,
            };

            let saved;
            if (reptile?.id) {
                saved = await OtherReptile.update(reptile.id, dataToSave);
            } else {
                saved = await OtherReptile.create(dataToSave);
            }
            
            if (onSubmit) onSubmit(saved, !reptile?.id);
        } catch (error) {
            console.error('Failed to save reptile:', error);
        }
        setIsSaving(false);
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={onCancel}></div>
            <Card className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-2xl max-h-[90vh] z-50 bg-slate-900 border-slate-700 flex flex-col">
                <CardHeader className="flex-shrink-0">
                    <CardTitle className="text-2xl text-slate-100">
                        {reptile ? `Edit ${reptile.name}` : 'Add New Reptile'}
                    </CardTitle>
                </CardHeader>

                <form onSubmit={handleSave} className="flex-grow overflow-y-auto space-y-4 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="name">Name *</Label>
                            <Input 
                                id="name" 
                                value={formData.name} 
                                onChange={(e) => handleChange('name', e.target.value)} 
                                required 
                                className="bg-slate-800 border-slate-600"
                            />
                        </div>
                        <div>
                            <Label htmlFor="species">Species *</Label>
                            <Input 
                                id="species" 
                                value={formData.species} 
                                onChange={(e) => handleChange('species', e.target.value)} 
                                required 
                                placeholder="e.g., Ball Python, Leopard Gecko..."
                                className="bg-slate-800 border-slate-600"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label htmlFor="morph">Morph</Label>
                            <Input 
                                id="morph" 
                                value={formData.morph} 
                                onChange={(e) => handleChange('morph', e.target.value)}
                                className="bg-slate-800 border-slate-600"
                            />
                        </div>
                        <div>
                            <Label htmlFor="sex">Sex</Label>
                            <Select value={formData.sex} onValueChange={(v) => handleChange('sex', v)}>
                                <SelectTrigger className="bg-slate-800 border-slate-600">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-600">
                                    <SelectItem value="Unsexed">Unsexed</SelectItem>
                                    <SelectItem value="Male">Male</SelectItem>
                                    <SelectItem value="Female">Female</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="birth_date">Birth/Acquisition Date</Label>
                            <Input 
                                id="birth_date" 
                                type="date" 
                                value={formData.birth_date} 
                                onChange={(e) => handleChange('birth_date', e.target.value)}
                                className="bg-slate-800 border-slate-600"
                            />
                        </div>
                    </div>

                    {/* Feeding Reminder Section */}
                    <div className="border border-slate-700 rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-base font-semibold">Feeding Reminders</Label>
                                <p className="text-xs text-slate-400">Get notified when it's time to feed</p>
                            </div>
                            <Switch
                                checked={formData.feeding_reminder_enabled}
                                onCheckedChange={(checked) => handleChange('feeding_reminder_enabled', checked)}
                            />
                        </div>

                        {formData.feeding_reminder_enabled && (
                            <div className="space-y-4 pt-2 border-t border-slate-700">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="feeding_interval">Days Between Feedings</Label>
                                        <Input
                                            id="feeding_interval"
                                            type="number"
                                            min="1"
                                            value={formData.feeding_interval_days}
                                            onChange={(e) => handleChange('feeding_interval_days', e.target.value)}
                                            className="bg-slate-800 border-slate-600"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="last_fed">Last Fed Date</Label>
                                        <Input
                                            id="last_fed"
                                            type="date"
                                            value={formData.last_fed_date}
                                            onChange={(e) => handleChange('last_fed_date', e.target.value)}
                                            className="bg-slate-800 border-slate-600"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Bell className="w-4 h-4 text-slate-400" />
                                            <Label>In-App Notifications</Label>
                                        </div>
                                        <Switch
                                            checked={formData.feeding_notification_enabled}
                                            onCheckedChange={(checked) => handleChange('feeding_notification_enabled', checked)}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-4 h-4 text-slate-400" />
                                            <Label>Email Reminders</Label>
                                        </div>
                                        <Switch
                                            checked={formData.feeding_email_enabled}
                                            onCheckedChange={(checked) => handleChange('feeding_email_enabled', checked)}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea 
                            id="notes" 
                            value={formData.notes} 
                            onChange={(e) => handleChange('notes', e.target.value)}
                            className="bg-slate-800 border-slate-600"
                        />
                    </div>

                    {/* Images */}
                    <div>
                        <Label>Images</Label>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                            {formData.image_urls.map((url, index) => (
                                <div key={url} className="relative group">
                                    <img 
                                        src={url} 
                                        alt={`reptile ${index + 1}`} 
                                        className="w-full h-24 object-cover rounded"
                                    />
                                    <Button 
                                        type="button" 
                                        size="icon" 
                                        variant="destructive" 
                                        className="absolute top-1 right-1 h-6 w-6"
                                        onClick={() => removeImage(url)}
                                    >
                                        <X className="h-4 w-4"/>
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <Button asChild variant="outline" className="w-full border-slate-600">
                            <label className="cursor-pointer">
                                <Upload className="w-4 h-4 mr-2"/> Upload Images
                                <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload}/>
                            </label>
                        </Button>
                    </div>
                </form>

                <CardFooter className="flex-shrink-0 mt-auto bg-slate-900/80 border-t border-slate-800 p-4 flex justify-between">
                    <div className="flex gap-2">
                        {reptile && onArchive && (
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => onArchive(reptile.id, !reptile.archived)}
                                className="border-yellow-600 text-yellow-500 hover:bg-yellow-900/20"
                            >
                                <Archive className="w-4 h-4 mr-2" />
                                {reptile.archived ? 'Unarchive' : 'Archive'}
                            </Button>
                        )}
                        {reptile && onDelete && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-slate-900 border-slate-700">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-slate-100">Delete {reptile.name}?</AlertDialogTitle>
                                        <AlertDialogDescription className="text-slate-400">
                                            This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel className="bg-slate-800 border-slate-600">Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDelete(reptile.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                    <div className="flex gap-4">
                        <Button variant="outline" onClick={onCancel} className="border-slate-600">Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
                            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {reptile?.id ? 'Update' : 'Add'} Reptile
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </motion.div>
    );
}