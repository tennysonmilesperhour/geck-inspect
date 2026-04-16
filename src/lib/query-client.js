import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: (failureCount, error) => {
				// Don't retry auth errors — a refresh won't help
				if (error?.status === 401 || error?.code === 'PGRST301') return false;
				return failureCount < 3;
			},
			retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15000),
			staleTime: 2 * 60 * 1000, // 2 minutes — avoids re-fetching data that just arrived
			gcTime: 10 * 60 * 1000,   // 10 minutes — keep unused cache entries longer
		},
	},
});