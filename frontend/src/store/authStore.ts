import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Auth0Client } from '@auth0/auth0-spa-js';
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
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
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
  bio?: string;
  location?: string;
  website?: string;
  created_at?: string;
  createdAt?: string;
}

function normalizeUser(data: AuthMeResponse): User {
  return {
    id: data.id,
    email: data.email,
    displayName: data.displayName ?? data.display_name ?? '',
    avatarUrl: data.avatarUrl ?? data.avatar_url ?? '',
    bio: data.bio ?? '',
    location: data.location ?? '',
    website: data.website ?? '',
    createdAt: data.createdAt ?? data.created_at ?? new Date().toISOString(),
  };
}

// Auth0 client singleton — only created in non-mock, non-debug mode
let auth0Client: Auth0Client | null = null;

function getAuth0Client(): Auth0Client {
  if (!auth0Client) {
    auth0Client = new Auth0Client({
      domain: config.auth0Domain,
      clientId: config.auth0ClientId,
      authorizationParams: {
        redirect_uri: config.auth0RedirectUri || window.location.origin,
        audience: config.auth0Audience,
        scope: 'openid profile email',
      },
      cacheLocation: 'memory',
      useRefreshTokens: true,
    });
  }
  return auth0Client;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
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

        // Debug mode: auto dev login
        if (config.enableDebug) {
          if (useAuthStore.getState().user) {
            await useAuthStore.getState().tryDevLogin();
          } else {
            set({ user: null, token: null, isAuthenticated: false, isLoading: false, isInitialized: true });
          }
          return;
        }

        // Production: Auth0 SDK
        try {
          const client = getAuth0Client();

          // Handle redirect callback if returning from Auth0 login
          if (window.location.search.includes('code=') && window.location.search.includes('state=')) {
            await client.handleRedirectCallback();
            window.history.replaceState({}, '', window.location.pathname);
          }

          // Try to get token silently — this will:
          // 1. Return cached token if available (same page session)
          // 2. Use refresh token if available
          // 3. Use Auth0 session cookie via hidden iframe (silent renew)
          // Only fails if user has no active Auth0 session at all
          const token = await client.getTokenSilently();

          // Token obtained — fetch user profile from our backend
          const response = await fetch(`${config.apiBaseUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const user = normalizeUser((await response.json()) as AuthMeResponse);
            set({ user, token, isAuthenticated: true, isLoading: false, isInitialized: true });
            return;
          }

          // Backend rejected the token
          set({ user: null, token: null, isAuthenticated: false, isLoading: false, isInitialized: true });
        } catch {
          // No active session — user needs to login
          set({ user: null, token: null, isAuthenticated: false, isLoading: false, isInitialized: true });
        }
      },

      login: async () => {
        if (config.useMockData) {
          set({ user: mockUser, token: 'mock-token', isAuthenticated: true, isInitialized: true });
          return;
        }
        if (config.enableDebug) {
          await useAuthStore.getState().tryDevLogin();
          return;
        }
        // Auth0 SDK redirect login (PKCE)
        const client = getAuth0Client();
        await client.loginWithRedirect();
      },

      logout: async () => {
        set({ user: null, token: null, isAuthenticated: false, isLoading: false, isInitialized: true });
        if (!config.useMockData && !config.enableDebug) {
          const client = getAuth0Client();
          await client.logout({ logoutParams: { returnTo: window.location.origin } });
        }
      },

      getToken: async (): Promise<string | null> => {
        if (config.useMockData) return 'mock-token';
        if (config.enableDebug) return useAuthStore.getState().token;
        try {
          const client = getAuth0Client();
          const token = await client.getTokenSilently();
          set({ token });
          return token;
        } catch {
          void useAuthStore.getState().logout();
          return null;
        }
      },

      setUser: (user: User, token: string) => {
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
        user: state.user,
      }),
    },
  ),
);
