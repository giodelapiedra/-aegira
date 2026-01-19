import { useEffect, useRef, lazy, Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { router } from './app/router';
import { useAuthStore } from './store/auth.store';
import { authService } from './services/auth.service';
import { ToastProvider } from './components/ui/Toast';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { ErrorBoundary } from './components/error';

// React Query DevTools - only in development
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((mod) => ({
        default: mod.ReactQueryDevtools,
      }))
    )
  : () => null;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds - data considered fresh
      gcTime: 1000 * 60 * 5, // 5 minutes - cache garbage collection
      retry: 1,
      refetchOnWindowFocus: true, // Refetch when user returns to tab
      refetchOnMount: true, // Refetch when component mounts if stale
    },
  },
});

function App() {
  const { setLoading, login, logout, isAuthenticated, accessToken, isLoading } = useAuthStore();
  const initDone = useRef(false);

  useEffect(() => {
    // Prevent double initialization in StrictMode
    if (initDone.current) return;
    initDone.current = true;

    const initAuth = async () => {
      // If we already have auth state from localStorage, verify it's still valid
      if (isAuthenticated && accessToken) {
        try {
          // Verify the token is still valid by fetching user data
          await authService.getMe();
          // Token is valid, keep the current state
          setLoading(false);
          return;
        } catch {
          // Token expired, try to refresh below
        }
      }

      // Try to refresh using httpOnly cookie (use raw axios to avoid interceptor)
      try {
        const response = await axios.post(
          `${API_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const { accessToken: newAccessToken } = response.data;

        // Fetch user data to complete auth state
        const userResponse = await axios.get(`${API_URL}/users/me`, {
          headers: { Authorization: `Bearer ${newAccessToken}` },
          withCredentials: true,
        });

        const user = userResponse.data;
        login(user, user.company!, newAccessToken);
      } catch {
        // No valid refresh token cookie, user needs to login
        logout();
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
        {/* React Query DevTools - bottom-right corner, only in dev */}
        {import.meta.env.DEV && (
          <Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
          </Suspense>
        )}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
