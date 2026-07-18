import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch } from '../api';
import { useAuthStore } from '@/store/auth';

describe('apiFetch — token refresh', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes via POST /auth/refresh (not /auth/admin/refresh) when the access token is expired', async () => {
    useAuthStore.getState().setAuth('old-token', -1, { userId: 'u1', tenantId: 't1', role: 'ADMIN' });

    vi.mocked(fetch).mockImplementation((url) => {
      if (String(url).endsWith('/auth/refresh')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              accessToken: 'new-token',
              expiresIn: 900,
              user: { userId: 'u1', tenantId: 't1', role: 'ADMIN' },
            }),
        } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response);
    });

    await apiFetch('/me');

    const calledUrls = vi.mocked(fetch).mock.calls.map((args) => String(args[0]));
    expect(calledUrls.some((u) => u.endsWith('/auth/refresh'))).toBe(true);
    expect(calledUrls.some((u) => u.includes('/auth/admin/refresh'))).toBe(false);
  });

  it('clears auth and sends no Authorization header when refresh fails', async () => {
    useAuthStore.getState().setAuth('old-token', -1, { userId: 'u1', tenantId: 't1', role: 'ADMIN' });

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({}),
    } as Response);

    await expect(apiFetch('/me')).rejects.toThrow();

    expect(useAuthStore.getState().accessToken).toBeNull();
    const meCall = vi.mocked(fetch).mock.calls.find((args) => String(args[0]).endsWith('/me'));
    const headers = meCall?.[1]?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBeUndefined();
  });
});
