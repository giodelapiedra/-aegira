import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Company } from '../types/user';

interface AuthState {
  user: User | null;
  company: Company | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: User) => void;
  setCompany: (company: Company) => void;
  setAccessToken: (accessToken: string) => void;
  login: (user: User, company: Company, accessToken: string) => void;
  logout: () => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      company: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) => set({ user }),

      setCompany: (company) => set({ company }),

      setAccessToken: (accessToken) => set({ accessToken }),

      login: (user, company, accessToken) =>
        set({
          user,
          company,
          accessToken,
          isAuthenticated: true,
          isLoading: false,
        }),

      logout: () =>
        set({
          user: null,
          company: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
        }),

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'auth-storage',
      // Security: Do NOT persist accessToken to localStorage (XSS vulnerability)
      // Only persist user info, token will be refreshed via httpOnly cookie
      partialize: (state) => ({
        user: state.user,
        company: state.company,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
