interface AppConfig {
  apiBaseUrl: string;
  auth0Domain: string;
  auth0ClientId: string;
  auth0Audience: string;
  auth0RedirectUri: string;
  azureMapsSubscriptionKey: string;
  useMockData: boolean;
  enableDebug: boolean;
}

export const config: AppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  auth0Domain: import.meta.env.VITE_AUTH0_DOMAIN || '',
  auth0ClientId: import.meta.env.VITE_AUTH0_CLIENT_ID || '',
  auth0Audience: import.meta.env.VITE_AUTH0_AUDIENCE || '',
  auth0RedirectUri: import.meta.env.VITE_AUTH0_REDIRECT_URI || window.location.origin,
  azureMapsSubscriptionKey: import.meta.env.VITE_AZURE_MAPS_SUBSCRIPTION_KEY || '',
  useMockData: import.meta.env.VITE_USE_MOCK_DATA === 'true',
  enableDebug: import.meta.env.VITE_ENABLE_DEBUG === 'true',
};

export const isDev = import.meta.env.DEV;
export const isProd = import.meta.env.PROD;
