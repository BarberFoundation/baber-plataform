import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/lib/types';

interface AuthState {
  accessToken: string | null;
  expiresAt: number | null;
  user: User | null;
  setAuth: (accessToken: string, expiresIn: number, user: User) => void;
  clearAuth: () => void;
  isTokenExpired: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      expiresAt: null,
      user: null,
      setAuth: (accessToken, expiresIn, user) =>
        set({ accessToken, expiresAt: Date.now() + expiresIn * 1000, user }),
      clearAuth: () => set({ accessToken: null, expiresAt: null, user: null }),
      isTokenExpired: () => {
        const { expiresAt } = get();
        if (!expiresAt) return true;
        return expiresAt - 30_000 < Date.now();
      },
    }),
    { name: 'baber-auth' },
  ),
);
