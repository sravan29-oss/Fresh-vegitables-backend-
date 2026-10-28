import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { HomepageSection, HomepageBanner } from '../types';
import { subscribeLiveUpdates } from '../services/liveSync';

export interface HomepageCMSPayload {
  sections: HomepageSection[];
  banners: HomepageBanner[];
}

export function useHomepageCMS() {
  const query = useQuery<HomepageCMSPayload>({
    queryKey: ['homepage-cms'],
    queryFn: async () => {
      const res = await api.get('/cms/homepage');
      return res.data?.data || { sections: [], banners: [] };
    },
    staleTime: 60000,
    retry: 1,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  // Listen for instant live updates from admin or other tabs
  useEffect(() => {
    const unsubscribe = subscribeLiveUpdates(['cms', 'products', 'categories', 'all'], () => {
      query.refetch();
    });
    return unsubscribe;
  }, [query]);

  return query;
}
