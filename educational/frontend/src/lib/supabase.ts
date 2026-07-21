import { createClient } from '@supabase/supabase-js';

const AUTH_TOKEN_KEY = 'studymentor_backend_token';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isLocal = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_BASE_URL = import.meta.env.VITE_API_URL || (isLocal ? '' : 'https://api.saieliteindia.info');

export function getStoredToken() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function getAccessToken() {
  const storedToken = getStoredToken();
  if (storedToken) return storedToken;

  if (directSupabaseAuth) {
    try {
      const result = await directSupabaseAuth.getSession();
      return result?.data?.session?.access_token || null;
    } catch {
      return null;
    }
  }

  return null;
}

// Keep storeToken helper to sync access tokens
function storeToken(token: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Request failed');
  }
  return data as T;
}

let directSupabaseAuth: any = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    directSupabaseAuth = client.auth;
  } catch (error) {
    console.error('[supabase] Failed to initialize Google auth client:', error);
  }
}

const auth = {
  async getSession() {
    if (directSupabaseAuth) {
      try {
        const result = await directSupabaseAuth.getSession();
        if (result?.data?.session) {
          return { data: { session: result.data.session } };
        }
      } catch {
        // fall through to backend session
      }
    }

    try {
      const data = await request<{ session: any | null }>('/api/auth/session');
      return { data: { session: data.session } };
    } catch {
      return { data: { session: null } };
    }
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const data = await request<{ session: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    storeToken(data.session?.access_token || null);
    return { data, error: null };
  },

  async signUp({ email, password }: { email: string; password: string }) {
    const data = await request<{ session: any }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    storeToken(data.session?.access_token || null);
    return { data, error: null };
  },

  async signInWithOAuth(options: { provider: string; options?: { redirectTo?: string } }) {
    if (!directSupabaseAuth) {
      throw new Error('Google login is not configured yet.');
    }

    const redirectTo = options?.options?.redirectTo || window.location.origin;
    return directSupabaseAuth.signInWithOAuth({
      provider: options.provider as 'google',
      options: { redirectTo },
    });
  },

  async signOut() {
    try {
      if (directSupabaseAuth?.signOut) {
        await directSupabaseAuth.signOut();
      }
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      storeToken(null);
    }
    return { error: null };
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    if (directSupabaseAuth?.onAuthStateChange) {
      const { data: listener } = directSupabaseAuth.onAuthStateChange((_event: string, session: any) => {
        callback(_event, session);
      });
      return { data: { subscription: listener?.subscription } };
    }

    const subscription = { unsubscribe: () => undefined };
    this.getSession().then((result) => {
      callback('INITIAL_SESSION', result.data.session);
    });
    return { data: { subscription } };
  },
};

export const supabaseClient = {
  auth,
  async getProfile(userId: string) {
    const data = await request<{ profile: any }>('/api/profiles/' + encodeURIComponent(userId));
    return data.profile;
  },
  async saveProfile(profile: Record<string, unknown>) {
    return request('/api/profiles', {
      method: 'POST',
      body: JSON.stringify(profile),
    });
  },
};

export const isSupabaseConfigured = () => Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = { auth };
export const supabaseAuth = auth;
