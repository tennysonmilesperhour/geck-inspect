import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const EVENT_TYPES = [
    { value: 'shed', label: '🦎 Shed', emoji: '🦎' },
    { value: 'feeding', label: '🍽️ Feeding', emoji: '🍽️' },
    { value: 'defecation', label: '💩 Defecation', emoji: '💩' },
    { value: 'cage_cleaning', label: '🧹 Cage Cleaning', emoji: '🧹' },
    { value: 'bug_feeding', label: '🦗 Bug Feeding', emoji: '🦗' },
    { value: 'custom', label: '✏️ Custom...', emoji: '✏️' },
];

export default function EventTracker({ entityId, entityType = 'gecko', onEventAdded, EventEntity }) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedType, setSelectedType] = useState(null);
    const [customName, setCustomName] = useState('');
    const [notes, setNotes] = useState('');
    const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 16));
    const [isSaving, setIsSaving] = useState(false);

    const handleSelectType = (type) => {
        setSelectedType(type);
        if (type !== 'custom') {
            setIsOpen(true);
        } else {
            setIsOpen(true);
        }
    };

    const handleSave = async () => {
        if (!selectedType) return;
        
        setIsSaving(true);
        try {
            const eventData = {
                [entityType === 'gecko' ? 'gecko_id' : 'reptile_id']: entityId,
                event_type: selectedType,
                event_date: new Date(eventDate).toISOString(),
                notes: notes || null,
            };
            
            if (selectedType === 'custom' && customName) {
                eventData.custom_event_name = customName;
            }

            await EventEntity.create(eventData);
            
            if (onEventAdded) {
                onEventAdded(eventData);
            }
            
            // Reset form
            setSelectedType(null);
            setCustomName('');
            setNotes('');
            setEventDate(new Date().toISOString().slice(0, 16));
            setIsOpen(false);
        } catch (error) {
            console.error('Failed to save event:', error);
        }
        setIsSaving(false);
    };

    const handleClose = () => {
        setIsOpen(false);
        setSelectedType(null);
        setCustomName('');
        setNotes('');
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="border-emerald-600 text-emerald-400 hover:bg-emerald-900/20 h-8"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Plus className="w-3 h-3 mr-1" />
                        Event
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-800 border-slate-600 z-50" onClick={(e) => e.stopPropagation()}>
                    {EVENT_TYPES.map((type) => (
                        <DropdownMenuItem
                            key={type.value}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSelectType(type.value);
                            }}
                            className="text-slate-200 hover:bg-slate-700 cursor-pointer"
                        >
                            {type.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="bg-slate-900 border-slate-700 text-slate-200" onClick={(e) => e.stopPropagation()}>
                    <DialogHeader>
                        <DialogTitle>
                            Record {selectedType === 'custom' ? 'Custom Event' : EVENT_TYPES.find(t => t.value === selectedType)?.label}
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        {selectedType === 'custom' && (
                            <div>
                                <Label>Event Name</Label>
                                <Input
                                    value={customName}
                                    onChange={(e) => setCustomName(e.target.value)}
                                    placeholder="e.g., Vet Visit, Weight Check..."
                                    className="bg-slate-800 border-slate-600"
                                />
                            </div>
                        )}
                        
                        <div>
                            <Label>Date & Time</Label>
                            <Input
                                type="datetime-local"
                                value={eventDate}
                                onChange={(e) => setEventDate(e.target.value)}
                                className="bg-slate-800 border-slate-600"
                            />
                        </div>
                        
                        <div>
                            <Label>Notes (Optional)</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Any additional details..."
                                className="bg-slate-800 border-slate-600"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={handleClose} className="border-slate-600">
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleSave} 
                            disabled={isSaving || (selectedType === 'custom' && !customName)}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Save Event
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}