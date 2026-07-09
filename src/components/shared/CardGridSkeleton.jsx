import { Skeleton } from '@/components/ui/skeleton';

/**
 * Placeholder grid shown while a page's card/image list is loading.
 *
 * Using shaped skeletons instead of a lone centered spinner makes the
 * wait feel shorter: the layout the data will land in is already on
 * screen, so the page doesn't jump when results arrive. Tune `count` to
 * roughly the number of items visible above the fold and `columns` to
 * match the real grid so the transition is seamless.
 */
export default function CardGridSkeleton({
  count = 8,
  columns = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  aspect = 'aspect-[3/4]',
  className = '',
}) {
  return (
    <div
      className={`grid gap-4 ${columns} ${className}`}
      aria-hidden="true"
      data-testid="card-grid-skeleton"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className={`w-full ${aspect} rounded-xl`} />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
