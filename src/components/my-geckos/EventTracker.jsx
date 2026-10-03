import { useState } from 'react';
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
import { useToast } from '@/components/ui/use-toast';
import { logFeedings, logShed, SHED_QUALITY_OPTIONS } from '@/lib/husbandryLog';

// The datetime-local input wants the local wall-clock time. toISOString()
// gave UTC, which the input then read as local, so every event logged at
// the default time was stored shifted by the UTC offset (an 8:15 pm
// feeding in California landed on 3:15 am the next day).
const nowForInput = () => format(new Date(), "yyyy-MM-dd'T'HH:mm");

const EVENT_TYPES = [
    { value: 'shed', label: '🦎 Shed', emoji: '🦎' },
    { value: 'feeding', label: '🍽️ Feeding', emoji: '🍽️' },
    { value: 'defecation', label: '💩 Defecation', emoji: '💩' },
    { value: 'cage_cleaning', label: '🧹 Cage Cleaning', emoji: '🧹' },
    { value: 'bug_feeding', label: '🦗 Bug Feeding', emoji: '🦗' },
    { value: 'custom', label: '✏️ Custom...', emoji: '✏️' },
];

// For a crested gecko, shed and feeding events go into the shared feeding
// and shed log (src/lib/husbandryLog.js) instead of the general event
// list: the shed forecast reads shed records, and the passport, buyer
// packet and feeding group schedule read feeding records. Other reptiles
// keep their event list.
const isHusbandryType = (type) => type === 'shed' || type === 'feeding' || type === 'bug_feeding';

/**
 * Props: entityId, entityType ('gecko' | 'reptile'), EventEntity,
 * onEventAdded(eventData), gecko (the gecko row, so a feeding can move
 * its feeding group; optional), onHusbandryLogged(kind) (called after a
 * gecko feeding or shed is logged).
 */
export default function EventTracker({ entityId, entityType = 'gecko', onEventAdded, EventEntity, gecko = null, onHusbandryLogged }) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedType, setSelectedType] = useState(null);
    const [customName, setCustomName] = useState('');
    const [notes, setNotes] = useState('');
    const [eventDate, setEventDate] = useState(nowForInput);
    const [isSaving, setIsSaving] = useState(false);
    const [shedQuality, setShedQuality] = useState('complete');
    const [accepted, setAccepted] = useState(true);
    const { toast } = useToast();
    const routesToLog = entityType === 'gecko' && isHusbandryType(selectedType);

    const handleSelectType = (type) => {
        setSelectedType(type);
        setEventDate(nowForInput());
        setShedQuality('complete');
        setAccepted(true);
        setIsOpen(true);
    };

    const handleSave = async () => {
        if (!selectedType) return;
        
        setIsSaving(true);
        try {
            if (routesToLog) {
                const day = (eventDate || '').slice(0, 10) || undefined;
                const target = gecko || { id: entityId };
                if (selectedType === 'shed') {
                    await logShed({ gecko: target, date: day, quality: shedQuality, notes: notes || null });
                    toast({ title: 'Shed logged', description: 'It now counts toward the shed forecast.' });
                } else {
                    await logFeedings({
                        entries: [{
                            gecko: target,
                            accepted,
                            notes: notes || null,
                            foodType: selectedType === 'bug_feeding' ? 'Insects' : 'CGD',
                        }],
                        date: day,
                    });
                    toast({
                        title: accepted ? 'Feeding logged' : 'Refused feeding logged',
                        description: accepted && target.feeding_group_id
                            ? 'Its feeding group schedule moved too.'
                            : undefined,
                    });
                }
                onHusbandryLogged?.(selectedType === 'shed' ? 'shed' : 'feeding');
                setSelectedType(null);
                setNotes('');
                setEventDate(nowForInput());
                setIsOpen(false);
                setIsSaving(false);
                return;
            }

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
            setEventDate(nowForInput());
            setIsOpen(false);
        } catch (error) {
            console.error('Failed to save event:', error);
            toast({ title: 'Event not saved', description: error.message || 'Please try again.', variant: 'destructive' });
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
                        className="border-emerald-600 text-emerald-400 hover:bg-emerald-800 h-7 bg-emerald-900/80 px-2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Plus className="w-3 h-3 mr-1" />
                        Event
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-emerald-900/95 border-emerald-600 z-[99999]" onClick={(e) => e.stopPropagation()}>
                    {EVENT_TYPES.map((type) => (
                        <DropdownMenuItem
                            key={type.value}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSelectType(type.value);
                            }}
                            className="text-emerald-100 hover:bg-emerald-700 hover:text-white cursor-pointer focus:bg-emerald-600 focus:text-white"
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
                        {routesToLog && selectedType === 'shed' && (
                            <div>
                                <Label>How did it come off?</Label>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {SHED_QUALITY_OPTIONS.map((q) => (
                                        <button
                                            key={q.value}
                                            type="button"
                                            onClick={() => setShedQuality(q.value)}
                                            aria-pressed={shedQuality === q.value}
                                            className={`touch:min-h-11 px-3 py-1.5 rounded-full text-sm border ${
                                                shedQuality === q.value
                                                    ? 'bg-emerald-600 border-emerald-400 text-white'
                                                    : 'bg-slate-800 border-slate-600 text-slate-300'
                                            }`}
                                        >
                                            {q.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {routesToLog && selectedType !== 'shed' && (
                            <div>
                                <Label>Did it eat?</Label>
                                <div className="mt-2 flex gap-2">
                                    {[{ v: true, l: 'Ate' }, { v: false, l: 'Refused' }].map((o) => (
                                        <button
                                            key={o.l}
                                            type="button"
                                            onClick={() => setAccepted(o.v)}
                                            aria-pressed={accepted === o.v}
                                            className={`touch:min-h-11 px-4 py-1.5 rounded-full text-sm border ${
                                                accepted === o.v
                                                    ? 'bg-emerald-600 border-emerald-400 text-white'
                                                    : 'bg-slate-800 border-slate-600 text-slate-300'
                                            }`}
                                        >
                                            {o.l}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

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
                                max={nowForInput()}
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
                            {routesToLog ? 'Save' : 'Save Event'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}