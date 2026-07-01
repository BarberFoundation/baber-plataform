export const SERVICE_LOOKUP = Symbol('IServiceLookup');

export interface ServiceLookupResult {
  durationMinutes: number;
  isActive: boolean;
}

export interface IServiceLookup {
  findById(id: string, tenantId: string): Promise<ServiceLookupResult | null>;
}
