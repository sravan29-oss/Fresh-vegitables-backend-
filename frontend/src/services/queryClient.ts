import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 0, // Always consider stale so window focus & navigation fetches newest response
      retry: 1,
    },
  },
});
