import React, { useState } from 'react';
import { FeedingGroup, Gecko } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit, Utensils } from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';

const GROUP_COLORS = ['#f97316', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#eab308', '#ef4444', '#06b6d4'];
const GROUP_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export default function FeedingGroupManager({ feedingGroups, geckos, onUpdate }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [form, setForm] = useState({
        label: 'A', name: '', diet_type: '', interval_days: 7, last_fed_date: '', color: GROUP_COLORS[0], notes: ''
    });

    const openCreate = () => {
        const usedLabels = feedingGroups.map(g => g.label);
        const nextLabel = GROUP_LABELS.find(l => !usedLabels.includes(l)) || String.fromCharCode(65 + feedingGroups.length);
        const colorIndex = feedingGroups.length % GROUP_COLORS.length;
        setForm({ label: nextLabel, name: '', diet_type: '', interval_days: 7, last_fed_date: '', color: GROUP_COLORS[colorIndex], notes: '' });
        setEditingGroup(null);
        setIsModalOpen(true);
    };

    const openEdit = (group) => {
        setForm({ ...group });
        setEditingGroup(group);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.interval_days) return;
        if (editingGroup) {
            await FeedingGroup.update(editingGroup.id, form);
        } else {
            await FeedingGroup.create(form);
        }
        setIsModalOpen(false);
        onUpdate();
    };

    const handleDelete = async (groupId) => {
        if (!window.confirm('Delete this feeding group? Geckos will not be deleted.')) return;
        // Clear gecko assignments
        const assigned = geckos.filter(g => g.feeding_group_id === groupId);
        await Promise.all(assigned.map(g => Gecko.update(g.id, { feeding_group_id: null })));
        await FeedingGroup.delete(groupId);
        onUpdate();
    };

    const handleMarkFed = async (group) => {
        await FeedingGroup.update(group.id, { last_fed_date: format(new Date(), 'yyyy-MM-dd') });
        onUpdate();
    };

    const getNextFeedDate = (group) => {
        if (!group.last_fed_date) return null;
        return addDays(new Date(group.last_fed_date), group.interval_days);
    };

    const getDaysUntil = (group) => {
        const next = getNextFeedDate(group);
        if (!next) return null;
        return differenceInDays(next, new Date());
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-slate-100 font-semibold flex items-center gap-2">
                    <Utensils className="w-5 h-5 text-orange-400" />
                    Feeding Groups
                </h3>
                <Button size="sm" onClick={openCreate} className="bg-orange-600 hover:bg-orange-700">
                    <Plus className="w-4 h-4 mr-1" /> New Group
                </Button>
            </div>

            {feedingGroups.length === 0 ? (
                <div className="text-center py-8 text-slate-500 border border-dashed border-slate-700 rounded-lg">
                    No feeding groups yet. Create one to start tracking feeding schedules.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {feedingGroups.map(group => {
                        const daysUntil = getDaysUntil(group);
                        const nextFeed = getNextFeedDate(group);
                        const assignedGeckos = geckos.filter(g => g.feeding_group_id === group.id);
                        const isOverdue = daysUntil !== null && daysUntil < 0;
                        const isDueSoon = daysUntil !== null && daysUntil >= 0 && daysUntil <= 1;

                        return (
                            <Card key={group.id} className={`bg-slate-800 border-slate-700 ${isOverdue ? 'ring-2 ring-red-500' : isDueSoon ? 'ring-2 ring-orange-500' : ''}`}>
                                <CardHeader className="pb-2 pt-3 px-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                                                style={{ backgroundColor: group.color || '#f97316' }}
                                            >
                                                {group.label}
                                            </div>
                                            <div>
                                                <div className="text-slate-100 font-semibold text-sm">{group.name || `Group ${group.label}`}</div>
                                                <div className="text-xs text-slate-400">{group.diet_type}</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-slate-200" onClick={() => openEdit(group)}>
                                                <Edit className="w-3 h-3" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={() => handleDelete(group.id)}>
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="px-3 pb-3 space-y-2">
                                    <div className="text-xs text-slate-400">
                                        Every <span className="text-slate-200 font-semibold">{group.interval_days}</span> days
                                    </div>
                                    {group.last_fed_date && (
                                        <div className="text-xs text-slate-400">
                                            Last fed: <span className="text-slate-300">{format(new Date(group.last_fed_date), 'MMM d')}</span>
                                        </div>
                                    )}
                                    {nextFeed && (
                                        <div className={`text-xs font-semibold ${isOverdue ? 'text-red-400' : isDueSoon ? 'text-orange-400' : 'text-emerald-400'}`}>
                                            {isOverdue ? `Overdue by ${Math.abs(daysUntil)} day(s)!` : daysUntil === 0 ? 'Feed today!' : `Next: ${format(nextFeed, 'MMM d')} (${daysUntil}d)`}
                                        </div>
                                    )}
                                    <div className="text-xs text-slate-500">{assignedGeckos.length} gecko(s)</div>
                                    <Button
                                        size="sm"
                                        className="w-full h-7 text-xs bg-orange-600 hover:bg-orange-700"
                                        onClick={() => handleMarkFed(group)}
                                    >
                                        ✓ Mark Fed Today
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="bg-slate-900 border-slate-700 text-slate-300">
                    <DialogHeader>
                        <DialogTitle className="text-slate-100">{editingGroup ? 'Edit Feeding Group' : 'New Feeding Group'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Group Label (A, B, C...)</Label>
                                <Input value={form.label} onChange={e => setForm({...form, label: e.target.value.toUpperCase().slice(0,2)})} className="bg-slate-800 border-slate-600" maxLength={2} />
                            </div>
                            <div>
                                <Label>Group Name (Optional)</Label>
                                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g., Juveniles" className="bg-slate-800 border-slate-600" />
                            </div>
                        </div>
                        <div>
                            <Label>Diet Type *</Label>
                            <Input value={form.diet_type} onChange={e => setForm({...form, diet_type: e.target.value})} placeholder="e.g., Repashy CGD, Pangea, Crickets" className="bg-slate-800 border-slate-600" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Interval (days) *</Label>
                                <Input type="number" min="1" value={form.interval_days} onChange={e => setForm({...form, interval_days: parseInt(e.target.value) || 7})} className="bg-slate-800 border-slate-600" />
                            </div>
                            <div>
                                <Label>Last Fed Date</Label>
                                <Input type="date" value={form.last_fed_date} onChange={e => setForm({...form, last_fed_date: e.target.value})} className="bg-slate-800 border-slate-600" />
                            </div>
                        </div>
                        <div>
                            <Label>Color</Label>
                            <div className="flex gap-2 flex-wrap mt-1">
                                {GROUP_COLORS.map(c => (
                                    <button key={c} className={`w-8 h-8 rounded-full border-2 ${form.color === c ? 'border-white scale-110' : 'border-transparent'} transition-transform`}
                                        style={{ backgroundColor: c }} onClick={() => setForm({...form, color: c})} type="button" />
                                ))}
                            </div>
                        </div>
                        <div>
                            <Label>Notes</Label>
                            <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Optional notes..." className="bg-slate-800 border-slate-600" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)} className="border-slate-600">Cancel</Button>
                        <Button onClick={handleSave} className="bg-orange-600 hover:bg-orange-700">Save Group</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}