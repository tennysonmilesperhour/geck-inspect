import StickerPreview from './StickerThemePreviews';
import { stickerDimensions } from '@/lib/store/customSticker';

export default function StickerMockup({ design, scale = false }) {
  const plaque = design.theme === 'enclosure_plaque';
  const dimensions = stickerDimensions(design);
  if (scale) return <div className="rounded-xl bg-stone-100 p-4 text-stone-700">
    <div className="h-64 flex items-center justify-center gap-5">
      <div style={{ width: `${dimensions.width / 6 * 100}%` }}><StickerPreview design={design} /></div>
      <div style={{ width: `${3.37 / 6 * 100}%`, aspectRatio: '85.6 / 54' }} className="rounded-md border border-stone-400 bg-stone-200 flex items-center justify-center px-2 text-center text-[10px]">Standard bank card<br />3.37 × 2.13 in</div>
    </div>
    <p className="text-center text-xs">Your sticker: {dimensions.label}</p><p className="mt-1 text-center text-[10px]">Relative sizes shown. Your screen is not a ruler.</p>
  </div>;
  return <figure>
    <div className="relative overflow-hidden rounded-xl" style={{ aspectRatio: '4 / 3' }}>
      <img src="/store/custom-stickers/enclosure-scene.webp" alt="Planted enclosure placement scene" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute" style={plaque ? { width: '30%', left: '50%', top: '67.5%', transform: 'translate(-50%, -50%)' } : { width: '15%', left: '72%', top: '53%' }}><StickerPreview design={design} /></div>
    </div>
  </figure>;
}
