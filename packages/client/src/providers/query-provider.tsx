import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: () => {
        document.dispatchEvent(new CustomEvent('atlasmail:query-error'));
      },
    },
  },
});

// When any query fails (after retries exhausted), notify the network status
// hook so it can run an immediate health check and show the connection banner.
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' && event.action.type === 'error') {
    document.dispatchEvent(new CustomEvent('atlasmail:query-error'));
  }
});

function AccountSwitchListener() {
  useEffect(() => {
    async function handleAccountSwitch() {
      // Cancel in-flight queries first so a slow response from the previous
      // account cannot land and re-populate the cache after it has been cleared.
      await queryClient.cancelQueries();
      // Remove all cached data so the new account's data loads fresh
      queryClient.clear();
    }
    window.addEventListener('atlasmail:account-switch', handleAccountSwitch);
    return () => window.removeEventListener('atlasmail:account-switch', handleAccountSwitch);
  }, []);

  return null;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AccountSwitchListener />
      {children}
    </QueryClientProvider>
  );
}
