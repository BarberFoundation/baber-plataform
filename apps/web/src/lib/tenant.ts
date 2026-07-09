import { apiFetch } from './api';

interface TenantSummary {
  id: string;
  slug: string;
  name: string;
}

export async function resolveTenantId(): Promise<string> {
  const slug = import.meta.env.VITE_TENANT_SLUG as string;
  if (!slug) throw new Error('VITE_TENANT_SLUG não configurado no .env');

  const tenant = await apiFetch<TenantSummary>(`/tenants/${slug}`);
  return tenant.id;
}
