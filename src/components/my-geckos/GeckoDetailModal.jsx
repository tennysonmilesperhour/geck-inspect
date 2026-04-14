import React, { useState, useEffect, useMemo } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WeightRecord, BreedingPlan, Egg, Gecko, GeckoEvent, GeckoImage } from '@/entities/all';
import { format, differenceInMonths } from 'date-fns';
import { X, Plus, Trash2, LineChart, Loader2, Award, GitBranch, Calendar, Baby, Users, Edit, Eye, EyeOff, History, Archive, ArchiveRestore, ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import LoadingSpinner from '../shared/LoadingSpinner';
import EventTracker from './EventTracker';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  generateOwnershipCertificatePDF,
  generateLineageCertificatePDF,
} from '@/lib/certificateUtils';
import { toast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function GeckoDetailModal({ gecko, onClose, onUpdate, onEdit, onArchive, allGeckos = [], currentUser = null }) {
  const navigate = useNavigate();

  const handleLineageClick = () => {
    const url = `${createPageUrl('Lineage')}?geckoId=${gecko.id}`;
    onClose();
    navigate(url);
  };
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
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const [slideshowImageIndex, setSlideshowImageIndex] = useState(0); // which image is currently shown via arrows
  const [showSlideshow, setShowSlideshow] = useState(false);
  // slotImageMap: { [slotIndex]: imageIndex } — user-assigned image per milestone slot
  const [slotImageMap, setSlotImageMap] = useState({});

  // Compute which growth milestone slots to show based on age
  const growthSlots = useMemo(() => {
    if (!gecko?.hatch_date || !gecko?.image_urls?.length) return [];
    const ageMonths = differenceInMonths(new Date(), new Date(gecko.hatch_date));
    const slots = [];
    // Every 6 months up to 36 months (3 years), then every 12 months
    let month = 6;
    while (month <= ageMonths) {
      if (month <= 36) {
        slots.push({ label: month < 12 ? `${month}mo` : month === 12 ? '1yr' : month === 18 ? '18mo' : month === 24 ? '2yr' : month === 30 ? '30mo' : '3yr', months: month });
        month += 6;
      } else {
        const years = month / 12;
        slots.push({ label: `${years}yr`, months: month });
        month += 12;
      }
    }
    return slots;
  }, [gecko]);

  // Get the image url for a given slot index (use assigned or default sequential)
  const _getSlotImage = React.useCallback((slotIdx) => {
    const imgIdx = slotImageMap[slotIdx] ?? Math.min(slotIdx, (gecko?.image_urls?.length ?? 1) - 1);
    return gecko?.image_urls?.[imgIdx] || 'https://i.imgur.com/sw9gnDp.png';
  }, [slotImageMap, gecko?.image_urls]);



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

  const [weightToDelete, setWeightToDelete] = useState(null);

  const _handleDeleteWeight = (recordId) => {
    setWeightToDelete(recordId);
  };

  const handleConfirmDeleteWeight = async () => {
    if (!weightToDelete) return;
    try {
      await WeightRecord.delete(weightToDelete);
      const remaining = weightRecords.filter(r => r.id !== weightToDelete);
      setWeightRecords(remaining);

      // Update Gecko.weight_grams to reflect the new latest (or null if none left)
      const newLatest = remaining.length > 0
        ? [...remaining].sort((a, b) => new Date(b.record_date) - new Date(a.record_date))[0].weight_grams
        : null;
      await Gecko.update(gecko.id, { weight_grams: newLatest });
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to delete weight record:', error);
    }
    setWeightToDelete(null);
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
      if (!gecko || !gecko.id) {
          toast({
              title: 'Save the gecko first',
              description: 'Certificates can only be generated for saved geckos.',
              variant: 'destructive',
          });
          return;
      }

      setIsGeneratingCert(true);

      try {
          // Resolve parents + grandparents from allGeckos (already in memory).
          const getById = (id) => (id ? allGeckos.find((g) => g.id === id) : null);
          const sire = getById(gecko.sire_id);
          const dam = getById(gecko.dam_id);
          const grandparents = {
              gsS: sire ? getById(sire.sire_id) : null,
              gdS: sire ? getById(sire.dam_id) : null,
              gsD: dam ? getById(dam.sire_id) : null,
              gdD: dam ? getById(dam.dam_id) : null,
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

          toast({
              title: 'Certificate downloaded',
              description: `${type === 'ownership' ? 'Ownership' : 'Lineage'} certificate for ${gecko.name || 'your gecko'} has been saved to your downloads.`,
          });
      } catch (error) {
          console.error('Failed to generate certificate:', error);
          toast({
              title: 'Could not generate certificate',
              description: error?.message || String(error) || 'Unknown error.',
              variant: 'destructive',
          });
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
              {/* Image area with optional slideshow */}
              <div className="space-y-2">
                {gecko.image_urls?.length > 1 && (
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setShowSlideshow(false)}
                      className={`text-xs px-3 py-1 rounded-full transition-colors ${!showSlideshow ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                    >
                      Latest
                    </button>
                    {growthSlots.length > 0 && (
                      <button
                        onClick={() => { setShowSlideshow(true); setSlideshowIndex(0); }}
                        className={`text-xs px-3 py-1 rounded-full flex items-center gap-1 transition-colors ${showSlideshow ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                      >
                        <Camera className="w-3 h-3" /> Growth Slideshow
                      </button>
                    )}
                  </div>
                )}

                {showSlideshow && growthSlots.length > 0 ? (
                  <div className="space-y-2">
                    {/* Milestone tabs */}
                    <div className="flex flex-wrap gap-1">
                      {growthSlots.map((slot, idx) => (
                        <button
                          key={slot.months}
                          onClick={() => {
                            setSlideshowIndex(idx);
                            // Reset image index to the assigned image for this slot
                            const assignedImg = slotImageMap[idx] ?? Math.min(idx, gecko.image_urls.length - 1);
                            setSlideshowImageIndex(assignedImg);
                          }}
                          className={`text-xs px-2 py-1 rounded transition-colors ${slideshowIndex === idx ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                    {/* Image display with navigation — arrows cycle through all photos */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const prev = Math.max(0, slideshowImageIndex - 1);
                          setSlideshowImageIndex(prev);
                          setSlotImageMap(m => ({ ...m, [slideshowIndex]: prev }));
                        }}
                        disabled={slideshowImageIndex === 0}
                        className="bg-slate-700 hover:bg-slate-600 text-white p-1.5 rounded-lg disabled:opacity-30 flex-shrink-0 z-10"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div className="relative flex-1 rounded-lg overflow-hidden bg-slate-800 min-h-[160px]">
                        <img
                          key={`slide-img-${slideshowImageIndex}`}
                          src={gecko.image_urls[slideshowImageIndex] || 'https://i.imgur.com/sw9gnDp.png'}
                          alt={`${gecko.name} photo ${slideshowImageIndex + 1}`}
                          className="w-full h-auto object-contain max-h-64"
                        />
                        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                          {growthSlots[slideshowIndex]?.label} · {slideshowImageIndex + 1}/{gecko.image_urls.length}
                        </div>
                      </div>
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const next = Math.min(gecko.image_urls.length - 1, slideshowImageIndex + 1);
                          setSlideshowImageIndex(next);
                          setSlotImageMap(m => ({ ...m, [slideshowIndex]: next }));
                        }}
                        disabled={slideshowImageIndex === gecko.image_urls.length - 1}
                        className="bg-slate-700 hover:bg-slate-600 text-white p-1.5 rounded-lg disabled:opacity-30 flex-shrink-0 z-10"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                    {/* Image picker for this slot */}
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Choose photo for "{growthSlots[slideshowIndex]?.label}":</p>
                      <div className="flex gap-1 flex-wrap">
                        {gecko.image_urls.map((url, imgIdx) => (
                          <button
                            key={url}
                            onClick={() => {
                              setSlideshowImageIndex(imgIdx);
                              setSlotImageMap(prev => ({ ...prev, [slideshowIndex]: imgIdx }));
                            }}
                            className={`w-10 h-10 rounded overflow-hidden border-2 transition-all flex-shrink-0 ${
                              slideshowImageIndex === imgIdx
                                ? 'border-emerald-500 scale-110'
                                : 'border-slate-600 hover:border-slate-400'
                            }`}
                          >
                            <img src={url} alt={`img ${imgIdx + 1}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 text-center">Milestone {slideshowIndex + 1} of {growthSlots.length}</p>
                  </div>
                ) : (
                  <div className="w-full rounded-lg overflow-hidden">
                    <img
                      src={gecko.image_urls?.[0] || 'https://i.imgur.com/sw9gnDp.png'}
                      alt={gecko.name}
                      className="w-full h-auto object-contain max-h-80"
                    />
                  </div>
                )}
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
                      {weightRecords.length > 0
                        ? `${[...weightRecords].sort((a, b) => new Date(b.record_date) - new Date(a.record_date))[0].weight_grams}g`
                        : gecko.weight_grams ? `${gecko.weight_grams}g` : 'Not recorded'}
                    </p>
                  </div>
                  {gecko.sex === 'Female' && gecko.is_gravid && (
                    <div className="col-span-2">
                      <span className="text-pink-400 font-semibold text-sm">💕 Gravid</span>
                      <div className="flex flex-wrap gap-4 mt-1">
                        {gecko.gravid_since && (
                          <p className="text-slate-300 text-xs">Since: {format(new Date(gecko.gravid_since), 'MMM d, yyyy')}</p>
                        )}
                        {gecko.egg_drop_date && (
                          <p className="text-slate-300 text-xs">Egg Drop: {format(new Date(gecko.egg_drop_date), 'MMM d, yyyy')}</p>
                        )}
                      </div>
                    </div>
                  )}
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
              <div className="space-y-3 mb-4">
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
                          // Sync GeckoImage rows so the public Gallery page
                          // actually shows the gecko's photos. Without this
                          // the gallery_display flag was decorative — the
                          // public gallery reads from gecko_images, not
                          // from the geckos table.
                          const imageUrls = Array.isArray(gecko.image_urls)
                            ? gecko.image_urls.filter(Boolean)
                            : [];
                          if (checked && imageUrls.length > 0) {
                            // Fetch existing GeckoImage rows tied to this gecko's URLs
                            // to avoid duplicates, then create any that are missing.
                            const existing = await GeckoImage.filter({
                              created_by: gecko.created_by,
                            }).catch(() => []);
                            const existingUrls = new Set(
                              existing.map((row) => row.image_url).filter(Boolean)
                            );
                            for (const url of imageUrls) {
                              if (existingUrls.has(url)) continue;
                              try {
                                await GeckoImage.create({
                                  image_url: url,
                                  primary_morph: (gecko.morphs_traits || 'crested_gecko')
                                    .split(',')[0]
                                    .trim()
                                    .toLowerCase()
                                    .replace(/\s+/g, '_') || 'crested_gecko',
                                  secondary_traits: Array.isArray(gecko.morph_tags)
                                    ? gecko.morph_tags
                                    : [],
                                  notes: `Gallery entry for ${gecko.name}`,
                                  verified: false,
                                });
                              } catch (imgErr) {
                                console.warn('Failed to create GeckoImage:', imgErr);
                              }
                            }
                          } else if (!checked && imageUrls.length > 0) {
                            // Toggle off: remove any GeckoImage rows that came
                            // from this gecko (matched by URL + creator).
                            const urlSet = new Set(imageUrls);
                            const mine = await GeckoImage.filter({
                              created_by: gecko.created_by,
                            }).catch(() => []);
                            for (const row of mine) {
                              if (urlSet.has(row.image_url)) {
                                try {
                                  await GeckoImage.delete(row.id);
                                } catch (delErr) {
                                  console.warn('Failed to remove GeckoImage:', delErr);
                                }
                              }
                            }
                          }
                          if (onUpdate) onUpdate();
                          toast({
                            title: checked ? 'Added to gallery' : 'Removed from gallery',
                            description: checked
                              ? `${imageUrls.length} ${imageUrls.length === 1 ? 'photo' : 'photos'} now in the public gallery`
                              : 'Photos removed from the public gallery',
                          });
                        } catch (error) {
                          console.error('Failed to update gallery display:', error);
                          toast({
                            title: 'Update failed',
                            description: error.message || 'Could not update gallery display.',
                            variant: 'destructive',
                          });
                        }
                      }}
                      className="data-[state=checked]:bg-emerald-500"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Show this gecko's photos in the public Gallery
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <div className="mb-3">
                  <EventTracker 
                    entityId={gecko.id} 
                    entityType="gecko" 
                    EventEntity={GeckoEvent}
                    onEventAdded={loadEventHistory}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    onClick={() => handleGenerateCertificate('ownership')}
                    disabled={isGeneratingCert}
                    variant="outline"
                    className="border-emerald-700 text-emerald-300 hover:bg-emerald-900/20"
                  >
                    {isGeneratingCert ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                    ) : (
                      <><Award className="w-4 h-4 mr-2" /> Ownership Certificate</>
                    )}
                  </Button>
                  <Button
                    onClick={() => handleGenerateCertificate('lineage')}
                    disabled={isGeneratingCert}
                    className="bg-emerald-700 hover:bg-emerald-800"
                  >
                    {isGeneratingCert ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                    ) : (
                      <><GitBranch className="w-4 h-4 mr-2" /> Lineage Certificate</>
                    )}
                  </Button>
                </div>

                <Button
                  variant="outline"
                  onClick={handleLineageClick}
                  className="w-full border-slate-600 hover:bg-slate-800"
                >
                  <GitBranch className="w-4 h-4 mr-2" />
                  View Lineage Tree
                </Button>

                {onArchive && (
                  <div className="space-y-2">
                    {gecko.archived && gecko.archive_reason && (
                      <div className="bg-slate-800 p-3 rounded-lg">
                        <p className="text-xs text-slate-400 mb-2">Archive reason:</p>
                        <div className="flex gap-2">
                          {[
                            { value: 'death', label: 'Passed Away' },
                            { value: 'sold', label: 'Sold' },
                            { value: 'other', label: 'Other' },
                          ].map(opt => (
                            <button
                              key={opt.value}
                              onClick={async () => {
                                await Gecko.update(gecko.id, { archive_reason: opt.value });
                                if (onUpdate) onUpdate();
                              }}
                              className={`text-xs px-2 py-1 rounded border transition-colors ${
                                gecko.archive_reason === opt.value
                                  ? 'border-yellow-500 bg-yellow-900/40 text-yellow-300'
                                  : 'border-slate-600 text-slate-400 hover:bg-slate-700'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => onArchive(gecko.id, !gecko.archived)}
                      className={gecko.archived ? "w-full border-emerald-600 text-emerald-500 hover:bg-emerald-900/20" : "w-full border-red-600 text-red-500 hover:bg-red-900/20"}
                    >
                      {gecko.archived ? (
                        <><ArchiveRestore className="w-4 h-4 mr-2" /> Unarchive</>
                      ) : (
                        <><Archive className="w-4 h-4 mr-2" /> Archive</>
                      )}
                    </Button>
                  </div>
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
                    <LoadingSpinner size="md" />
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
                          <AlertDialog open={weightToDelete === record.id} onOpenChange={(open) => { if (!open) setWeightToDelete(null); }}>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setWeightToDelete(record.id)}>
                                <Trash2 className="w-3 h-3 text-red-500"/>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-slate-900 border-slate-700">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-slate-100">Delete weight record?</AlertDialogTitle>
                                <AlertDialogDescription className="text-slate-400">
                                  This will permanently delete the weight record from {format(new Date(record.record_date), 'MMM d, yyyy')}. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-600">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleConfirmDeleteWeight} className="bg-red-700 hover:bg-red-800">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
                    <Button onClick={handleAddWeight} className="w-full">Save</Button>
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