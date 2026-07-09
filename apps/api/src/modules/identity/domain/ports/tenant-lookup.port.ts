export const TENANT_LOOKUP = Symbol('ITenantLookup');

export interface ITenantLookup {
  existsById(tenantId: string): Promise<boolean>;
}
