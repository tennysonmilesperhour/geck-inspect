import { normalizePhotoCrop } from '@/lib/store/customSticker';

/** Every preview, cart, proof, and order uses the persisted crop. */
export default function StickerPhoto({ design, className = '', style = {} }) {
  const crop = normalizePhotoCrop(design.photo_crop);
  if (!design.photo_url) return (
    <div className={`flex items-center justify-center ${className}`} style={{ background: '#ddd9cd', color: '#666052', fontSize: '3.2cqw', ...style }}>
      Your gecko goes here
    </div>
  );
  return (
    <div className={`overflow-hidden ${className}`} style={style}>
      <img src={design.photo_url} alt={design.name ? `${design.name} sticker artwork` : 'Your gecko artwork'}
        crossOrigin="anonymous" draggable={false} decoding="async"
        className="w-full h-full"
        style={{ objectFit: design.photo_treatment === 'cutout' ? 'contain' : 'cover', objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})`, transformOrigin: `${crop.x}% ${crop.y}%` }} />
    </div>
  );
}
