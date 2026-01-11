import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Edit, Calendar, DollarSign, Sparkles, Weight } from 'lucide-react';
import { format } from 'date-fns';
import EventTracker from './EventTracker';
import { GeckoEvent } from '@/entities/all';

const DEFAULT_GECKO_IMAGE = 'https://i.imgur.com/sw9gnDp.png';

export default function GeckoCard({ gecko, weightRecords = [], onView, onEdit }) {
  // Find the latest weight for this gecko from the passed weightRecords
  const latestWeight = React.useMemo(() => {
    const geckoWeights = weightRecords.filter(w => w.gecko_id === gecko.id);
    if (geckoWeights.length === 0) return null;
    
    // Sort by date descending and get the first one
    const sorted = geckoWeights.sort((a, b) => new Date(b.record_date) - new Date(a.record_date));
    return sorted[0]?.weight_grams;
  }, [gecko.id, weightRecords]);

  const primaryImage = gecko.image_urls && gecko.image_urls.length > 0 
    ? gecko.image_urls[0] 
    : DEFAULT_GECKO_IMAGE;

  const getStatusColor = (status) => {
    const colors = {
      'Pet': 'bg-gradient-to-r from-blue-400 to-blue-600',
      'Future Breeder': 'bg-gradient-to-r from-purple-400 to-purple-600',
      'Holdback': 'bg-gradient-to-r from-yellow-400 to-orange-500',
      'Ready to Breed': 'bg-gradient-to-r from-green-400 to-emerald-600',
      'Proven': 'bg-gradient-to-r from-emerald-400 to-teal-600',
      'For Sale': 'bg-gradient-to-r from-orange-400 to-red-500',
      'Sold': 'bg-gradient-to-r from-gray-400 to-gray-600'
    };
    return `${colors[status] || 'bg-gray-500'} text-white shadow-lg`;
  };

  const getSexIcon = (sex) => {
    return sex === 'Male' ? '♂' : sex === 'Female' ? '♀' : '?';
  };

  const getSexColor = (sex) => {
    return sex === 'Male' ? 'text-blue-400' : sex === 'Female' ? 'text-pink-400' : 'text-gray-400';
  };

  const handleViewClick = (e) => {
    e.stopPropagation();
    if (onView) onView(gecko);
  };
    
  const handleEditClick = (e) => {
    e.stopPropagation();
    if (onEdit) onEdit(gecko);
  };

  return (
    <Card className="gecko-card group overflow-hidden">
      <div className="relative">
        <img 
          src={primaryImage} 
          alt={gecko.name}
          className="w-full h-40 sm:h-56 object-cover"
          onError={(e) => { e.target.src = DEFAULT_GECKO_IMAGE; }}
        />
        
        <div className="absolute top-2 left-2 flex items-center gap-2">
          <span className={`${getSexColor(gecko.sex)} text-3xl font-bold drop-shadow-lg`}>
            {getSexIcon(gecko.sex)}
          </span>
        </div>

        <div className="absolute bottom-2 right-2 flex flex-col gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
          <Button
            size="sm"
            onClick={handleViewClick}
            className="bg-blue-600/90 hover:bg-blue-700 text-white font-semibold shadow-lg backdrop-blur-sm text-xs h-8 w-8 sm:w-auto sm:px-3"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline sm:ml-1">View</span>
          </Button>
          <Button
            size="sm"
            onClick={handleEditClick}
            className="bg-white/90 hover:bg-white text-gray-900 font-semibold shadow-lg backdrop-blur-sm text-xs h-8 w-8 sm:w-auto sm:px-3"
          >
            <Edit className="w-4 h-4" />
            <span className="hidden sm:inline sm:ml-1">Edit</span>
          </Button>
        </div>
      </div>

      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-base sm:text-lg text-emerald-100 truncate flex-1 leading-7">
            {gecko.name}
          </h3>
          <div className="flex-shrink-0">
            <EventTracker 
              entityId={gecko.id} 
              entityType="gecko" 
              EventEntity={GeckoEvent}
            />
          </div>
        </div>
        {gecko.gecko_id_code && (
          <p className="text-xs text-slate-400 font-medium truncate">
            ID: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">{gecko.gecko_id_code}</span>
          </p>
        )}
        <div className="flex justify-between items-center text-xs sm:text-sm">
          {latestWeight ? (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Weight className="w-3 h-3" />
              <span className="font-semibold">{latestWeight}g</span>
            </div>
          ) : (
            <div className="text-slate-500 text-xs">No weight</div>
          )}
          {gecko.hatch_date && (
            <div className="flex items-center gap-1.5 text-slate-400">
              <Calendar className="w-3 h-3" />
              <span className="font-medium">
                {format(new Date(gecko.hatch_date), 'MM/dd/yy')}
              </span>
            </div>
          )}
        </div>
        {gecko.incubation_days && (
          <div className="text-xs text-blue-400 font-semibold">
            {gecko.incubation_days} days incubated
          </div>
        )}
      </CardContent>
    </Card>
  );
}