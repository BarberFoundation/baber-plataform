import { useAuthStore } from '@/store/auth';
import type { User } from '@/lib/types';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api/v1';

async function refreshToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken: string; expiresIn: number; user: User };
    useAuthStore.getState().setAuth(data.accessToken, data.expiresIn, data.user);
    return data.accessToken;
  } catch {
    return null;
  }
}

async function resolveToken(): Promise<string | null> {
  const { accessToken, isTokenExpired, clearAuth } = useAuthStore.getState();
  if (!accessToken) return null;
  if (!isTokenExpired()) return accessToken;
  const fresh = await refreshToken();
  if (!fresh) {
    clearAuth();
    return null;
  }
  return fresh;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await resolveToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText })) as { message?: string };
    throw new Error(body.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}
