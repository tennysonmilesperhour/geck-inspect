import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WeightRecord, BreedingPlan, Egg, Gecko, GeckoEvent } from '@/entities/all';
import { format } from 'date-fns';
import { X, Plus, Trash2, LineChart, Loader2, Award, GitBranch, Calendar, Baby, Users, FileText, Edit, Eye, EyeOff, History, Archive, ArchiveRestore } from 'lucide-react';
import EventTracker from './EventTracker';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { generateLineageCertificate } from '@/functions/generateLineageCertificate';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function GeckoDetailModal({ gecko, onClose, onUpdate, onEdit, onArchive, allGeckos = [] }) {
  const [weightRecords, setWeightRecords] = useState([]);
  const [breedingHistory, setBreedingHistory] = useState([]);
  const [eggHistory, setEggHistory] = useState([]);
  const [offspring, setOffspring] = useState([]);
  const [eventHistory, setEventHistory] = useState([]);
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingCert, setIsGeneratingCert] = useState(false);
  const [isPublic, setIsPublic] = useState(gecko?.is_public ?? true);

  const loadEventHistory = async () => {
    if (!gecko) return;
    try {
      const events = await GeckoEvent.filter({ gecko_id: gecko.id }, '-event_date');
      setEventHistory(events);
    } catch (error) {
      console.error('Failed to load event history:', error);
    }
  };

  useEffect(() => {
    const fetchDetailedData = async () => {
      if (!gecko) return;
      
      setIsLoading(true);
      try {
        const [weights, breedings, eggs, children, events] = await Promise.allSettled([
          WeightRecord.filter({ gecko_id: gecko.id }, '-record_date'),
          Promise.all([
            BreedingPlan.filter({ sire_id: gecko.id }, '-created_date'),
            BreedingPlan.filter({ dam_id: gecko.id }, '-created_date')
          ]).then(([sireBreedings, damBreedings]) => [...sireBreedings, ...damBreedings]),
          gecko.sex === 'Female' ? Egg.filter({ 
            breeding_plan_id: { $in: await BreedingPlan.filter({ dam_id: gecko.id }).then(plans => plans.map(p => p.id)) }
          }, '-lay_date') : Promise.resolve([]),
          Promise.all([
            Gecko.filter({ sire_id: gecko.id }, '-hatch_date'),
            Gecko.filter({ dam_id: gecko.id }, '-hatch_date')
          ]).then(([sireOffspring, damOffspring]) => [...sireOffspring, ...damOffspring]),
          GeckoEvent.filter({ gecko_id: gecko.id }, '-event_date')
        ]);

        setWeightRecords(weights.status === 'fulfilled' ? weights.value : []);
        setBreedingHistory(breedings.status === 'fulfilled' ? breedings.value : []);
        setEggHistory(eggs.status === 'fulfilled' ? eggs.value : []);
        setOffspring(children.status === 'fulfilled' ? children.value : []);
        setEventHistory(events.status === 'fulfilled' ? events.value : []);
      } catch (error) {
        console.error('Failed to fetch detailed gecko data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetailedData();
  }, [gecko]);

  const handleAddWeight = async () => {
    if (!newWeight || isNaN(parseFloat(newWeight))) return;

    try {
      const weightValue = parseFloat(newWeight);
      const newRecord = {
        gecko_id: gecko.id,
        weight_grams: weightValue,
        record_date: new Date().toISOString().split('T')[0],
      };

      const createdRecord = await WeightRecord.create(newRecord);
      
      // Also update the gecko's current weight
      await Gecko.update(gecko.id, {
        weight_grams: weightValue
      });
      
      setWeightRecords([createdRecord, ...weightRecords]);
      setNewWeight('');
      setShowAddWeight(false);
      
      // Notify parent component to refresh gecko data
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
        await WeightRecord.delete(recordId);
        setWeightRecords(weightRecords.filter(r => r.id !== recordId));
      } catch (error) {
        console.error('Failed to delete weight record:', error);
      }
    }
  };

  const handleTogglePublic = async (checked) => {
    try {
      await Gecko.update(gecko.id, { is_public: checked });
      setIsPublic(checked);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to update public status:', error);
    }
  };

  const handleGenerateCertificate = async (type) => {
      if (!gecko || !gecko.id) return;

      setIsGeneratingCert(true);

      try {
          const { default: html2canvas } = await import('html2canvas');
          const { default: jsPDF } = await import('jspdf');

          const { data: htmlContent } = await generateLineageCertificate({
              geckoId: gecko.id,
              certificateType: type,
          });

          // Create hidden iframe to render HTML
          const iframe = document.createElement('iframe');
          iframe.style.position = 'absolute';
          iframe.style.left = '-9999px';
          iframe.style.width = '800px';
          iframe.style.height = '1200px';
          document.body.appendChild(iframe);

          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          iframeDoc.open();
          iframeDoc.write(htmlContent);
          iframeDoc.close();

          // Wait for images to load
          await new Promise(resolve => {
              if (iframeDoc.readyState === 'complete') {
                  setTimeout(resolve, 500);
              } else {
                  iframe.onload = () => setTimeout(resolve, 500);
              }
          });

          // Convert to canvas
          const canvas = await html2canvas(iframeDoc.body, {
              scale: 2,
              useCORS: true,
              allowTaint: true,
              backgroundColor: '#ffffff'
          });

          // Create PDF
          const imgData = canvas.toDataURL('image/jpeg', 1.0);
          const pdf = new jsPDF({
              orientation: 'portrait',
              unit: 'mm',
              format: 'a4'
          });

          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const imgWidth = canvas.width;
          const imgHeight = canvas.height;
          const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
          const imgX = (pdfWidth - imgWidth * ratio) / 2;
          const imgY = 0;

          pdf.addImage(imgData, 'JPEG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

          // Clean up
          document.body.removeChild(iframe);

          // Open PDF in new tab
          const pdfBlob = pdf.output('blob');
          const pdfUrl = URL.createObjectURL(pdfBlob);
          window.open(pdfUrl, '_blank');

          // Also trigger download
          const link = document.createElement('a');
          link.href = pdfUrl;
          link.download = `${gecko.name}_Certificate_${new Date().toISOString().split('T')[0]}.pdf`;
          link.click();

          setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);

      } catch (error) {
          console.error("Failed to generate certificate:", error);
      } finally {
          setIsGeneratingCert(false);
      }
  };

  // Get parent info for display
  const sire = allGeckos.find(g => g.id === gecko.sire_id);
  const dam = allGeckos.find(g => g.id === gecko.dam_id);

  const chartData = [...weightRecords].reverse().map(r => ({
    date: format(new Date(r.record_date), 'MMM d'),
    weight: r.weight_grams,
    fullDate: format(new Date(r.record_date), 'PPP')
  }));

  if (!gecko) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="max-w-6xl w-full max-h-[90vh] flex flex-col bg-slate-900 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-4">
            <CardTitle className="text-slate-100">{gecko.name}</CardTitle>
            {gecko.gecko_id_code && (
              <Badge variant="outline" className="text-slate-300">
                ID: {gecko.gecko_id_code}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button 
                variant="outline" 
                size="sm"
                onClick={() => onEdit(gecko)}
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
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column: Basic Info & Image */}
            <div className="space-y-6">
              <div className="w-full rounded-lg overflow-hidden">
                <img 
                  src={gecko.image_urls?.[0] || 'https://i.imgur.com/sw9gnDp.png'} 
                  alt={gecko.name} 
                  className="w-full h-auto object-contain max-h-80"
                />
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-100">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4 text-slate-300 text-sm">
                  <div>
                    <span className="text-slate-400">Sex:</span>
                    <p className="font-medium">{gecko.sex}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Status:</span>
                    <p className="font-medium">{gecko.status}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Hatch Date:</span>
                    <p className="font-medium">
                      {gecko.hatch_date ? format(new Date(gecko.hatch_date), 'PPP') : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Current Weight:</span>
                    <p className="font-medium">
                      {gecko.weight_grams ? `${gecko.weight_grams}g` : 'Not recorded'}
                    </p>
                  </div>
                </div>
                
                {gecko.morphs_traits && (
                  <div>
                    <span className="text-slate-400 text-sm">Morphs & Traits:</span>
                    <p className="text-slate-300 font-medium mt-1">{gecko.morphs_traits}</p>
                  </div>
                )}

                {gecko.notes && (
                  <div>
                    <span className="text-slate-400 text-sm">Notes:</span>
                    <p className="text-slate-300 mt-1">{gecko.notes}</p>
                  </div>
                )}
              </div>

              {/* Public Display Toggle */}
              <div className="space-y-3">
                <div className="bg-slate-800 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isPublic ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-slate-500" />}
                      <Label className="text-slate-300 cursor-pointer">Public Display</Label>
                    </div>
                    <Switch
                      checked={isPublic}
                      onCheckedChange={handleTogglePublic}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {isPublic ? 'Visible in your public profile' : 'Hidden from public view'}
                  </p>
                </div>
                
                <div className="bg-slate-800 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 cursor-pointer">Gallery Display</Label>
                    <Switch
                      checked={gecko.gallery_display || false}
                      onCheckedChange={async (checked) => {
                        try {
                          await Gecko.update(gecko.id, { gallery_display: checked });
                          if (onUpdate) onUpdate();
                        } catch (error) {
                          console.error("Failed to update gallery display:", error);
                        }
                      }}
                      className="data-[state=checked]:bg-emerald-500"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Show in public gallery
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <EventTracker 
                  entityId={gecko.id} 
                  entityType="gecko" 
                  EventEntity={GeckoEvent}
                  onEventAdded={loadEventHistory}
                />

                <Button
                  onClick={() => handleGenerateCertificate('lineage')}
                  disabled={isGeneratingCert}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {isGeneratingCert ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                  ) : (
                    <><Award className="w-4 h-4 mr-2" /> Generate Certificate</>
                  )}
                </Button>

                <Link to={createPageUrl(`Lineage?geckoId=${gecko.id}`)}>
                  <Button variant="outline" className="w-full border-slate-600 hover:bg-slate-800">
                    <GitBranch className="w-4 h-4 mr-2" />
                    View Lineage Tree
                  </Button>
                </Link>

                {onArchive && (
                  <Button
                    variant="outline"
                    onClick={() => onArchive(gecko.id, !gecko.archived)}
                    className="w-full border-yellow-600 text-yellow-500 hover:bg-yellow-900/20"
                  >
                    {gecko.archived ? (
                      <><ArchiveRestore className="w-4 h-4 mr-2" /> Unarchive</>
                    ) : (
                      <><Archive className="w-4 h-4 mr-2" /> Archive</>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Middle Column: Weight & Breeding History */}
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
                        <Legend wrapperStyle={{ color: '#d1fae5' }} />
                        <Line type="monotone" dataKey="weight" stroke="#86efac" strokeWidth={2} dot={{r: 4}} activeDot={{ r: 8 }} />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                    
                    <div className="max-h-32 overflow-y-auto space-y-2">
                      {weightRecords.map(record => (
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
                  <Button onClick={() => setShowAddWeight(true)} variant="outline" size="sm" className="w-full mt-4">
                    <Plus className="w-4 h-4 mr-2" /> Add Weight Record
                  </Button>
                ) : (
                  <div className="space-y-3 mt-4">
                    <Input
                      type="number"
                      placeholder="Weight in grams"
                      value={newWeight}
                      onChange={(e) => setNewWeight(e.target.value)}
                      className="bg-slate-800 text-sm w-full"
                    />
                    <Button onClick={handleAddWeight} className="w-full bg-emerald-600 hover:bg-emerald-700">Save</Button>
                  </div>
                )}
              </div>

              {/* Breeding History */}
              <div>
                <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Breeding History
                </h3>
                
                {breedingHistory.length > 0 ? (
                  <div className="space-y-3">
                    {breedingHistory.map(breeding => {
                      const partner = gecko.sex === 'Male' 
                        ? allGeckos.find(g => g.id === breeding.dam_id)
                        : allGeckos.find(g => g.id === breeding.sire_id);
                      
                      return (
                        <div key={breeding.id} className="bg-slate-800 p-3 rounded-lg">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                            <span className="text-slate-300 font-medium">
                              Paired with: {partner?.name || 'Unknown'}
                            </span>
                            <div className="flex items-center gap-2 mt-2 sm:mt-0">
                              <Badge variant={breeding.status === 'Successful' ? 'default' : 'secondary'}>
                                {breeding.status}
                              </Badge>
                              {breeding.is_public && (
                                <Badge variant="outline" className="text-emerald-400 border-emerald-400">
                                  Public
                                </Badge>
                              )}
                            </div>
                          </div>
                          {breeding.pairing_date && (
                            <p className="text-slate-400 text-sm">
                              Paired: {format(new Date(breeding.pairing_date), 'PPP')}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <Label className="text-xs text-slate-500">Public Display</Label>
                            <Switch
                              checked={breeding.is_public}
                              onCheckedChange={async (checked) => {
                                try {
                                  await BreedingPlan.update(breeding.id, { is_public: checked });
                                  const updated = await Promise.allSettled([
                                    WeightRecord.filter({ gecko_id: gecko.id }, '-record_date'),
                                    Promise.all([
                                      BreedingPlan.filter({ sire_id: gecko.id }, '-created_date'),
                                      BreedingPlan.filter({ dam_id: gecko.id }, '-created_date')
                                    ]).then(([sireBreedings, damBreedings]) => [...sireBreedings, ...damBreedings]),
                                    gecko.sex === 'Female' ? Egg.filter({ 
                                      breeding_plan_id: { $in: await BreedingPlan.filter({ dam_id: gecko.id }).then(plans => plans.map(p => p.id)) }
                                    }, '-lay_date') : Promise.resolve([]),
                                    Promise.all([
                                      Gecko.filter({ sire_id: gecko.id }, '-hatch_date'),
                                      Gecko.filter({ dam_id: gecko.id }, '-hatch_date')
                                    ]).then(([sireOffspring, damOffspring]) => [...sireOffspring, ...damOffspring])
                                  ]);
                                  setBreedingHistory(updated[1].status === 'fulfilled' ? updated[1].value : []);
                                } catch (error) {
                                  console.error('Failed to update breeding plan:', error);
                                }
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-4">No breeding history recorded.</p>
                )}
              </div>
            </div>

            {/* Right Column: Event History, Parentage, Offspring, Eggs */}
            <div className="space-y-6">
              {/* Event History */}
              <div>
                <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Event History
                </h3>
                {eventHistory.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
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

              {/* Parentage */}
              <div>
                <h3 className="text-lg font-semibold text-slate-100 mb-4">Parentage</h3>
                <div className="space-y-3">
                  <div className="bg-slate-800 p-3 rounded-lg">
                    <p className="text-slate-400 text-sm">Sire (Father)</p>
                    <p className="text-slate-200 font-medium">
                      {sire ? sire.name : (gecko.sire_name || 'Unknown')}
                    </p>
                  </div>
                  <div className="bg-slate-800 p-3 rounded-lg">
                    <p className="text-slate-400 text-sm">Dam (Mother)</p>
                    <p className="text-slate-200 font-medium">
                      {dam ? dam.name : (gecko.dam_name || 'Unknown')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Offspring */}
              {offspring.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                    <Baby className="w-5 h-5" />
                    Offspring ({offspring.length})
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {offspring.map(child => (
                      <div key={child.id} className="bg-slate-800 p-2 rounded flex items-center justify-between">
                        <div>
                          <p className="text-slate-200 font-medium text-sm">{child.name}</p>
                          <p className="text-slate-400 text-xs">{child.sex}</p>
                        </div>
                        {child.hatch_date && (
                          <p className="text-slate-400 text-xs">
                            {format(new Date(child.hatch_date), 'MMM yyyy')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Egg History (for females) */}
              {gecko.sex === 'Female' && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Egg History
                  </h3>
                  
                  {eggHistory.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {eggHistory.map(egg => (
                        <div key={egg.id} className="bg-slate-800 p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-slate-300 text-sm">
                              Laid: {format(new Date(egg.lay_date), 'MMM d, yyyy')}
                            </span>
                            <Badge variant={egg.status === 'Hatched' ? 'default' : 'secondary'} className="text-xs">
                              {egg.status}
                            </Badge>
                          </div>
                          {egg.hatch_date_actual && (
                            <p className="text-slate-400 text-xs">
                              Hatched: {format(new Date(egg.hatch_date_actual), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-center py-4">No eggs recorded.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}