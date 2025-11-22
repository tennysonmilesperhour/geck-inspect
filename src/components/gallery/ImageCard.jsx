import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, User, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const DEFAULT_GECKO_IMAGE = 'https://i.imgur.com/sw9gnDp.png';

export default function ImageCard({ image, uploader, onImageSelect, onLike }) {
  const handleLike = (e) => {
    e.stopPropagation();
    if (onLike) {
      onLike(image.id);
    }
  };

  const uploaderName = uploader?.full_name || 'Anonymous';
  const profileLink = uploader ? createPageUrl(`PublicProfile?userId=${uploader.id}`) : '#';

  return (
    <Card 
      className="overflow-hidden group cursor-pointer bg-slate-900 border-slate-700 shadow-lg hover:shadow-emerald-500/10 transition-all duration-300"
      onClick={() => onImageSelect(image)}
    >
      <div className="relative aspect-square">
        <img
          src={image.image_url}
          alt={image.primary_morph}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            if (e.target.src !== DEFAULT_GECKO_IMAGE) {
              e.target.src = DEFAULT_GECKO_IMAGE;
            }
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute bottom-2 left-2 right-2 text-white">
          <h3 className="font-bold text-slate-100 text-sm capitalize truncate">{image.primary_morph.replace(/_/g, ' ')}</h3>
          {image.secondary_traits && image.secondary_traits.length > 0 && (
            <p className="text-xs text-slate-300 capitalize truncate">
              {image.secondary_traits.join(', ').replace(/_/g, ' ')}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}