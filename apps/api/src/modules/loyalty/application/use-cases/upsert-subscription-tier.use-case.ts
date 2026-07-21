import { Inject, Injectable } from '@nestjs/common';
import {
  SUBSCRIPTION_TIER_REPOSITORY,
  ISubscriptionTierRepository,
} from '../../domain/repositories/subscription-tier.repository';
import { SubscriptionTier, SubscriptionTierName, SubscriptionTierServiceItem } from '../../domain/entities/subscription-tier.entity';

export interface UpsertSubscriptionTierInput {
  tenantId: string;
  tier: SubscriptionTierName;
  services: SubscriptionTierServiceItem[];
  discountPercentage: number;
  isActive: boolean;
}

@Injectable()
export class UpsertSubscriptionTierUseCase {
  constructor(
    @Inject(SUBSCRIPTION_TIER_REPOSITORY) private readonly tierRepo: ISubscriptionTierRepository,
  ) {}

  async execute(input: UpsertSubscriptionTierInput): Promise<SubscriptionTier> {
    const existing = await this.tierRepo.findByTenantIdAndTier(input.tenantId, input.tier);
    const tier = SubscriptionTier.create({
      id: existing?.id,
      createdAt: existing?.createdAt,
      tenantId: input.tenantId,
      tier: input.tier,
      services: input.services,
      discountPercentage: input.discountPercentage,
      isActive: input.isActive,
    });
    return this.tierRepo.upsert(tier);
  }
}
