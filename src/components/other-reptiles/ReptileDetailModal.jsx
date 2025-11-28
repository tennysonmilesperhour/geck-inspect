import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReptileEvent, OtherReptile } from '@/entities/all';
import { format } from 'date-fns';
import { X, Plus, Trash2, LineChart, Loader2, History, Edit, Calendar } from 'lucide-react';
import EventTracker from '../my-geckos/EventTracker';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function ReptileDetailModal({ reptile, onClose, onUpdate, onEdit }) {
    const [weightRecords, setWeightRecords] = useState([]);
    const [eventHistory, setEventHistory] = useState([]);
    const [showAddWeight, setShowAddWeight] = useState(false);
    const [newWeight, setNewWeight] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const loadEventHistory = async () => {
        if (!reptile) return;
        try {
            const events = await ReptileEvent.filter({ reptile_id: reptile.id }, '-event_date');
            setEventHistory(events);
        } catch (error) {
            console.error('Failed to load event history:', error);
        }
    };

    useEffect(() => {
        const fetchDetailedData = async () => {
            if (!reptile) return;
            
            setIsLoading(true);
            try {
                // Fetch weight records from events that have weight data
                const events = await ReptileEvent.filter({ reptile_id: reptile.id }, '-event_date');
                setEventHistory(events);
                
                // Extract weight records from feeding events or create mock weight tracking
                const weights = events
                    .filter(e => e.event_type === 'weight' || (e.notes && e.notes.includes('Weight:')))
                    .map(e => ({
                        id: e.id,
                        record_date: e.event_date,
                        weight_grams: parseFloat(e.notes?.match(/Weight:\s*(\d+)/)?.[1]) || 0
                    }))
                    .filter(w => w.weight_grams > 0);
                
                setWeightRecords(weights);
            } catch (error) {
                console.error('Failed to fetch detailed reptile data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDetailedData();
    }, [reptile]);

    const handleAddWeight = async () => {
        if (!newWeight || isNaN(parseFloat(newWeight))) return;

        try {
            const weightValue = parseFloat(newWeight);
            
            // Create a weight event
            const newEvent = await ReptileEvent.create({
                reptile_id: reptile.id,
                event_type: 'custom',
                custom_event_name: 'Weight Check',
                event_date: new Date().toISOString(),
                notes: `Weight: ${weightValue}g`
            });
            
            setWeightRecords([{
                id: newEvent.id,
                record_date: newEvent.event_date,
                weight_grams: weightValue
            }, ...weightRecords]);
            
            setEventHistory([newEvent, ...eventHistory]);
            setNewWeight('');
            setShowAddWeight(false);
            
            if (onUpdate) {
                onUpdate();
            }
        } catch (error) {
            console.error('Failed to add weight record:', error);
        }
    };

    const handleDeleteWeight = async (recordId) => {
        if (window.confirm("Are you sure you want to delete this weight record?")) {
            try {
                await ReptileEvent.delete(recordId);
                setWeightRecords(weightRecords.filter(r => r.id !== recordId));
                setEventHistory(eventHistory.filter(e => e.id !== recordId));
            } catch (error) {
                console.error('Failed to delete weight record:', error);
            }
        }
    };

    const chartData = [...weightRecords].reverse().map(r => ({
        date: format(new Date(r.record_date), 'MMM d'),
        weight: r.weight_grams,
        fullDate: format(new Date(r.record_date), 'PPP')
    }));

    if (!reptile) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="max-w-4xl w-full max-h-[90vh] flex flex-col bg-slate-900 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-700">
                    <div className="flex items-center gap-4">
                        <CardTitle className="text-slate-100">{reptile.name}</CardTitle>
                        <Badge variant="outline" className="text-slate-300">
                            {reptile.species}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => onEdit(reptile)}
                            className="border-slate-600 hover:bg-slate-800"
                        >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                        </Button>
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className="w-5 h-5 text-slate-400" />
                        </Button>
                    </div>
                </CardHeader>
                
                <CardContent className="p-6 overflow-y-auto flex-1">
                    <div className="grid lg:grid-cols-2 gap-8">
                        {/* Left Column: Basic Info & Image */}
                        <div className="space-y-6">
                            <div className="aspect-video w-full rounded-lg overflow-hidden">
                                <img 
                                    src={reptile.image_urls?.[0] || 'https://i.imgur.com/sw9gnDp.png'} 
                                    alt={reptile.name} 
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-slate-100">Basic Information</h3>
                                <div className="grid grid-cols-2 gap-4 text-slate-300 text-sm">
                                    <div>
                                        <span className="text-slate-400">Species:</span>
                                        <p className="font-medium">{reptile.species}</p>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">Sex:</span>
                                        <p className="font-medium">{reptile.sex || 'Unknown'}</p>
                                    </div>
                                    {reptile.morph && (
                                        <div>
                                            <span className="text-slate-400">Morph:</span>
                                            <p className="font-medium">{reptile.morph}</p>
                                        </div>
                                    )}
                                    {reptile.birth_date && (
                                        <div>
                                            <span className="text-slate-400">Birth Date:</span>
                                            <p className="font-medium">
                                                {format(new Date(reptile.birth_date), 'PPP')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                
                                {reptile.notes && (
                                    <div>
                                        <span className="text-slate-400 text-sm">Notes:</span>
                                        <p className="text-slate-300 mt-1">{reptile.notes}</p>
                                    </div>
                                )}

                                {reptile.feeding_reminder_enabled && (
                                    <div className="bg-slate-800 p-4 rounded-lg">
                                        <h4 className="text-sm font-semibold text-slate-200 mb-2">Feeding Schedule</h4>
                                        <div className="text-sm text-slate-400 space-y-1">
                                            <p>Interval: Every {reptile.feeding_interval_days} days</p>
                                            {reptile.last_fed_date && (
                                                <p>Last Fed: {format(new Date(reptile.last_fed_date), 'PPP')}</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                <EventTracker 
                                    entityId={reptile.id} 
                                    entityType="reptile" 
                                    EventEntity={ReptileEvent}
                                    onEventAdded={loadEventHistory}
                                />
                            </div>
                        </div>

                        {/* Right Column: Weight & Event History */}
                        <div className="space-y-6">
                            {/* Weight Tracking */}
                            <div>
                                <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                                    <LineChart className="w-5 h-5" />
                                    Weight History
                                </h3>
                                
                                {isLoading ? (
                                    <div className="flex items-center justify-center h-48">
                                        <Loader2 className="w-8 h-8 animate-spin text-emerald-400"/>
                                    </div>
                                ) : chartData.length > 0 ? (
                                    <div className="space-y-4">
                                        <ResponsiveContainer width="100%" height={200}>
                                            <RechartsLineChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(134, 239, 172, 0.2)" />
                                                <XAxis dataKey="date" stroke="#a7f3d0" />
                                                <YAxis stroke="#a7f3d0" domain={['dataMin - 2', 'dataMax + 2']} unit="g"/>
                                                <Tooltip 
                                                    contentStyle={{ backgroundColor: '#022c22', border: '1px solid rgba(134, 239, 172, 0.2)'}} 
                                                    labelStyle={{ color: '#d1fae5' }}
                                                    itemStyle={{ color: '#86efac' }}
                                                    formatter={(value) => [`${value}g`, 'Weight']}
                                                    labelFormatter={(label, payload) => payload[0]?.payload.fullDate || label}
                                                />
                                                <Line type="monotone" dataKey="weight" stroke="#86efac" strokeWidth={2} dot={{r: 4}} activeDot={{ r: 8 }} />
                                            </RechartsLineChart>
                                        </ResponsiveContainer>
                                        
                                        <div className="max-h-32 overflow-y-auto space-y-2">
                                            {weightRecords.slice(0, 5).map(record => (
                                                <div key={record.id} className="flex justify-between items-center bg-slate-800 p-2 rounded text-sm">
                                                    <span className="text-slate-300">{format(new Date(record.record_date), 'MMM d, yyyy')}</span>
                                                    <span className="font-bold text-emerald-400">{record.weight_grams}g</span>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteWeight(record.id)}>
                                                        <Trash2 className="w-3 h-3 text-red-500"/>
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-slate-400 text-center py-8">No weight records yet.</p>
                                )}

                                {/* Add Weight Record */}
                                {!showAddWeight ? (
                                    <Button onClick={() => setShowAddWeight(true)} variant="outline" size="sm" className="w-full mt-4 border-slate-600">
                                        <Plus className="w-4 h-4 mr-2" /> Add Weight Record
                                    </Button>
                                ) : (
                                    <div className="flex gap-2 items-center mt-4">
                                        <Input
                                            type="number"
                                            placeholder="Weight in grams"
                                            value={newWeight}
                                            onChange={(e) => setNewWeight(e.target.value)}
                                            className="bg-slate-800 text-sm border-slate-600"
                                        />
                                        <Button onClick={handleAddWeight} size="sm" className="bg-emerald-600 hover:bg-emerald-700">Save</Button>
                                        <Button variant="ghost" size="sm" onClick={() => setShowAddWeight(false)}>Cancel</Button>
                                    </div>
                                )}
                            </div>

                            {/* Event History */}
                            <div>
                                <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                                    <History className="w-5 h-5" />
                                    Event History
                                </h3>
                                {eventHistory.length > 0 ? (
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {eventHistory.map(event => {
                                            const eventIcons = {
                                                shed: '🦎',
                                                feeding: '🍽️',
                                                defecation: '💩',
                                                cage_cleaning: '🧹',
                                                bug_feeding: '🦗',
                                                custom: '✏️'
                                            };
                                            return (
                                                <div key={event.id} className="bg-slate-800 p-3 rounded-lg">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-lg">{eventIcons[event.event_type] || '📋'}</span>
                                                            <span className="text-slate-200 font-medium text-sm capitalize">
                                                                {event.event_type === 'custom' ? event.custom_event_name : event.event_type.replace('_', ' ')}
                                                            </span>
                                                        </div>
                                                        <span className="text-slate-400 text-xs">
                                                            {format(new Date(event.event_date), 'MMM d, yyyy h:mm a')}
                                                        </span>
                                                    </div>
                                                    {event.notes && (
                                                        <p className="text-slate-400 text-xs mt-1">{event.notes}</p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-slate-400 text-center py-4 text-sm">No events recorded yet.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}