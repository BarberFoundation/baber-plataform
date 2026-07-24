import { SubscriptionTier } from '../entities/subscription-tier.entity';

export const SUBSCRIPTION_TIER_REPOSITORY = Symbol('ISubscriptionTierRepository');

export interface ISubscriptionTierRepository {
  findByTenantId(tenantId: string): Promise<SubscriptionTier[]>;
  findByTenantIdAndName(tenantId: string, name: string): Promise<SubscriptionTier | null>;
  findById(id: string, tenantId: string): Promise<SubscriptionTier | null>;
  upsert(tier: SubscriptionTier): Promise<SubscriptionTier>;
}
