import { useQuery } from '@tanstack/react-query';
import { WeightRecord } from '@/entities/all';
import { readinessFor } from '@/lib/breedingReadiness';

/**
 * Loads the weigh-ins for a set of females and returns a lookup:
 * readinessOf(gecko) gives her breeding readiness (see lib/breedingReadiness),
 * or null until the weigh-ins have loaded. Used wherever a dam is chosen.
 */
export default function useFemaleReadiness(females, enabled = true) {
  const ids = (females || []).map((gecko) => gecko?.id).filter(Boolean);
  const query = useQuery({
    queryKey: ['female-weights', ids],
    queryFn: () => WeightRecord.filter({ gecko_id: { $in: ids } }, '-record_date'),
    enabled: enabled && ids.length > 0,
    staleTime: 60_000,
  });
  const weights = query.data || [];
  return (gecko) => (query.isSuccess ? readinessFor(gecko, weights) : null);
}
