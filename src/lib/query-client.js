import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: (failureCount, error) => {
				// Don't retry auth errors, a refresh won't help
				if (error?.status === 401 || error?.code === 'PGRST301') return false;
				return failureCount < 3;
			},
			retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15000),
			staleTime: 2 * 60 * 1000, // 2 minutes, avoids re-fetching data that just arrived
			gcTime: 10 * 60 * 1000,   // 10 minutes, keep unused cache entries longer
		},
	},
});

// Any page that adds, removes or changes geckos dispatches a window
// 'geckos_changed' event. The Dashboard caches its counts, so without this
// it kept showing "Add your first gecko" for up to two minutes after the
// first gecko was saved (audit step 31). Mark those caches stale here, once
// for the whole app, so the next Dashboard visit refetches.
//
// 'field-mode' is the collection copy that Today, the Log tab, the one-tap
// log (/log) and Field Mode share (src/lib/fieldModeData.js). Until 16 Oct
// 2026 it was left out, so on a phone a gecko added a moment ago was
// missing from all four for two minutes, and a brand new member could not
// log the first feeding for the first gecko.
export function invalidateCollectionCaches(client = queryClientInstance) {
	client.invalidateQueries({ queryKey: ['dashboard', 'personal'] });
	client.invalidateQueries({ queryKey: ['dashboard', 'hatchery'] });
	client.invalidateQueries({ queryKey: ['field-mode'] });
}

if (typeof window !== 'undefined') {
	window.addEventListener('geckos_changed', () => invalidateCollectionCaches());
}
