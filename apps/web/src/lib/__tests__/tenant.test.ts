import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch } from '../api';
import { resolveTenantId } from '../tenant';

vi.mock('../api', () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

describe('resolveTenantId', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('VITE_TENANT_SLUG', 'barbearia-do-amigo');
  });

  it('fetches the tenant by slug and returns its id', async () => {
    mockedApiFetch.mockResolvedValue({ id: 'tenant-real-id', slug: 'barbearia-do-amigo', name: 'Barbearia do Amigo' });

    const tenantId = await resolveTenantId();

    expect(tenantId).toBe('tenant-real-id');
    expect(mockedApiFetch).toHaveBeenCalledWith('/tenants/barbearia-do-amigo');
  });

  it('throws a clear error when VITE_TENANT_SLUG is not configured', async () => {
    vi.stubEnv('VITE_TENANT_SLUG', '');

    await expect(resolveTenantId()).rejects.toThrow('VITE_TENANT_SLUG não configurado no .env');
    expect(mockedApiFetch).not.toHaveBeenCalled();
  });
});
