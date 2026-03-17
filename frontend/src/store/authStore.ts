import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { config } from '../config';
import { mockUser } from '../mocks/data';
import api from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  initializeAuth: () => Promise<void>;
  login: () => void;
  logout: () => void;
  setUser: (user: User, token: string) => void;
  tryDevLogin: () => Promise<void>;
}

interface AuthMeResponse {
  id: string;
  email: string;
  display_name?: string;
  displayName?: string;
  avatar_url?: string;
  avatarUrl?: string;
  created_at?: string;
  createdAt?: string;
}

function normalizeUser(data: AuthMeResponse): User {
  return {
    id: data.id,
    email: data.email,
    displayName: data.displayName ?? data.display_name ?? '',
    avatarUrl: data.avatarUrl ?? data.avatar_url ?? '',
    createdAt: data.createdAt ?? data.created_at ?? new Date().toISOString(),
  };
}

async function fetchCurrentUser(token: string): Promise<User> {
  const response = await fetch(`${config.apiBaseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Auth bootstrap failed with status ${response.status}`);
  }

  return normalizeUser((await response.json()) as AuthMeResponse);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // In mock mode, start as logged in with the demo user
      user: config.useMockData ? mockUser : null,
      token: config.useMockData ? 'mock-token' : null,
      isAuthenticated: config.useMockData,
      isLoading: false,
      isInitialized: config.useMockData,

      initializeAuth: async () => {
        const state = useAuthStore.getState();
        if (state.isInitialized || state.isLoading || config.useMockData) {
          return;
        }

        set({ isLoading: true });

        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const tokenFromHash = hashParams.get('access_token');
        const token = tokenFromHash ?? useAuthStore.getState().token;

        if (tokenFromHash) {
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
        }

        if (!token) {
          set({ user: null, token: null, isAuthenticated: false, isLoading: false, isInitialized: true });
          return;
        }

        if (config.enableDebug && token === 'dev-token') {
          await useAuthStore.getState().tryDevLogin();
          return;
        }

        try {
          const user = await fetchCurrentUser(token);
          set({ user, token, isAuthenticated: true, isLoading: false, isInitialized: true });
        } catch (error) {
          console.error('Auth initialization failed:', error);
          set({ user: null, token: null, isAuthenticated: false, isLoading: false, isInitialized: true });
        }
      },

      login: () => {
        if (config.useMockData) {
          set({ user: mockUser, token: 'mock-token', isAuthenticated: true, isInitialized: true });
          return;
        }
        if (config.enableDebug) {
          useAuthStore.getState().tryDevLogin();
          return;
        }
        window.location.href = `https://${config.auth0Domain}/authorize?client_id=${config.auth0ClientId}&redirect_uri=${encodeURIComponent(config.auth0RedirectUri)}&response_type=token&scope=openid%20profile%20email&audience=${encodeURIComponent(config.auth0Audience)}`;
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false, isLoading: false, isInitialized: true });
        if (!config.useMockData && !config.enableDebug) {
          window.location.href = `https://${config.auth0Domain}/v2/logout?client_id=${config.auth0ClientId}&returnTo=${encodeURIComponent(window.location.origin)}`;
        }
      },

      setUser: (user, token) => {
        set({ user, token, isAuthenticated: true, isLoading: false, isInitialized: true });
      },

      tryDevLogin: async () => {
        set({ isLoading: true });
        try {
          const res = await api.get('/auth/me', {
            headers: { Authorization: 'Bearer dev-token' },
          });
          const user = normalizeUser(res.data as AuthMeResponse);
          set({ user, token: 'dev-token', isAuthenticated: true, isLoading: false, isInitialized: true });
        } catch (e) {
          console.error('Dev login failed (is backend running?):', e);
          set({ user: null, token: null, isAuthenticated: false, isLoading: false, isInitialized: true });
        }
      },
    }),
    {
      name: 'photomap-auth',
      partialize: (state) => ({
        // Only persist user profile, NOT the token.
        // Token stays in memory only — on page reload initializeAuth()
        // will re-validate via /auth/me or require a fresh login.
        user: state.user,
      }),
    },
  ),
);
