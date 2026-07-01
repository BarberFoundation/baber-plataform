import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../auth';

const MOCK_USER = { userId: 'u1', tenantId: 't1', role: 'ADMIN' };

beforeEach(() => {
  useAuthStore.getState().clearAuth();
  vi.restoreAllMocks();
});

describe('auth store', () => {
  it('starts unauthenticated', () => {
    const { accessToken, user } = useAuthStore.getState();
    expect(accessToken).toBeNull();
    expect(user).toBeNull();
  });

  it('setAuth stores token and user', () => {
    useAuthStore.getState().setAuth('tok', 900, MOCK_USER);
    const { accessToken, user, expiresAt } = useAuthStore.getState();
    expect(accessToken).toBe('tok');
    expect(user).toEqual(MOCK_USER);
    expect(expiresAt).toBeGreaterThan(Date.now());
  });

  it('isTokenExpired returns false for fresh token', () => {
    useAuthStore.getState().setAuth('tok', 900, MOCK_USER);
    expect(useAuthStore.getState().isTokenExpired()).toBe(false);
  });

  it('isTokenExpired returns true when no token', () => {
    expect(useAuthStore.getState().isTokenExpired()).toBe(true);
  });

  it('isTokenExpired returns true within 30s of expiry', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    useAuthStore.getState().setAuth('tok', 900, MOCK_USER);
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000 + 900_000 - 25_000);
    expect(useAuthStore.getState().isTokenExpired()).toBe(true);
  });

  it('clearAuth removes token and user', () => {
    useAuthStore.getState().setAuth('tok', 900, MOCK_USER);
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
