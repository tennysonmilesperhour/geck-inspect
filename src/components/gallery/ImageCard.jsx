import { Card } from '@/components/ui/card';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';

export default function ImageCard({ image, onImageSelect, thumbnail = false }) {
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
          loading="lazy"
          decoding="async"
          width={thumbnail ? 400 : undefined}
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