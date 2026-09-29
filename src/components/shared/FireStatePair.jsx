import { FIRE_SLOTS, fireStatePhotos, hasFireStatePhotos } from '@/lib/fireStatePhotos';

// The fired-up and fired-down photos side by side, for the listing page,
// the passport and the gecko detail view. Shows nothing until the owner has
// tagged at least one (edit form, Images). onOpen(url) makes each photo a
// button, for pages with a lightbox.
export default function FireStatePair({
  gecko,
  onOpen,
  className = '',
  headingClassName = 'text-sm font-semibold text-slate-200',
}) {
  if (!hasFireStatePhotos(gecko)) return null;
  const slots = fireStatePhotos(gecko);
  const name = gecko?.name || 'Gecko';

  return (
    <section className={className} data-fire-state-pair>
      <h3 className={headingClassName}>Fired up and fired down</h3>
      <p className="text-xs text-slate-500 mt-0.5 mb-2">The same gecko at its darkest and palest colors.</p>
      <div className="grid grid-cols-2 gap-2">
        {FIRE_SLOTS.map((slot) => {
          const url = slots[slot.id];
          const meta = (url && gecko?.image_crop_data?.[url]) || {};
          const image = url ? (
            <img
              src={url}
              alt={`${name}, ${slot.label.toLowerCase()}`}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
              style={{
                objectPosition: `${meta.x ?? 50}% ${meta.y ?? 50}%`,
                transform: meta.rotation ? `rotate(${meta.rotation}deg)` : undefined,
              }}
            />
          ) : (
            <div className="w-full h-full grid place-items-center p-3 text-center text-xs text-slate-500">
              No {slot.label.toLowerCase()} photo yet
            </div>
          );
          return (
            <figure key={slot.id} className="rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
              <div className="aspect-square overflow-hidden">
                {url && onOpen ? (
                  <button
                    type="button"
                    onClick={() => onOpen(url)}
                    className="block w-full h-full"
                    aria-label={`View the ${slot.label.toLowerCase()} photo larger`}
                  >
                    {image}
                  </button>
                ) : image}
              </div>
              <figcaption className="px-2 py-1.5 text-xs font-medium text-slate-200 border-t border-slate-700">
                {slot.label}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
