import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { todayInTimezone } from '@/lib/timezone';
import type { TenantSettings } from '@/lib/types';

// Browser locale defaults to the device's timezone, not the tenant's — a
// barbershop's "today" must follow the tenant's configured timezone instead.
export function useTenantTimezone(): string | undefined {
  const { data } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => apiFetch<TenantSettings>('/tenants/me'),
    staleTime: 5 * 60 * 1000,
  });
  return data?.timezone;
}

export function useTodayInTenantTimezone(): string {
  const timezone = useTenantTimezone();
  return todayInTimezone(timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
}
