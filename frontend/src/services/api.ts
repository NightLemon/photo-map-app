import axios from 'axios';
import { config } from '../config';
import { useAuthStore } from '../store/authStore';

/** Recursively convert snake_case keys to camelCase */
function snakeToCamel(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([key, val]) => [
        key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
        snakeToCamel(val),
      ]),
    );
  }
  return obj;
}

const api = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token to every request
api.interceptors.request.use(async (reqConfig) => {
  const { getToken } = useAuthStore.getState();
  const token = await getToken();
  if (token) {
    reqConfig.headers.Authorization = `Bearer ${token}`;
  }
  return reqConfig;
});

// Transform snake_case responses to camelCase + global error handler
api.interceptors.response.use(
  (res) => {
    if (res.data) res.data = snakeToCamel(res.data);
    return res;
  },
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

export default api;
