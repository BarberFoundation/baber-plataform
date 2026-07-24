import { Inject, Injectable } from '@nestjs/common';
import {
  SUBSCRIPTION_TIER_REPOSITORY,
  ISubscriptionTierRepository,
} from '../../domain/repositories/subscription-tier.repository';
import { SubscriptionTier, SubscriptionTierServiceItem } from '../../domain/entities/subscription-tier.entity';
import { SubscriptionTierNameTakenError } from '../../domain/errors/loyalty.errors';

export interface CreateSubscriptionTierInput {
  tenantId: string;
  name: string;
  services: SubscriptionTierServiceItem[];
  discountPercentage: number;
}

@Injectable()
export class CreateSubscriptionTierUseCase {
  constructor(
    @Inject(SUBSCRIPTION_TIER_REPOSITORY) private readonly tierRepo: ISubscriptionTierRepository,
  ) {}

  async execute(input: CreateSubscriptionTierInput): Promise<SubscriptionTier> {
    const existing = await this.tierRepo.findByTenantIdAndName(input.tenantId, input.name);
    if (existing) throw new SubscriptionTierNameTakenError();

    const tier = SubscriptionTier.create({
      tenantId: input.tenantId,
      name: input.name,
      services: input.services,
      discountPercentage: input.discountPercentage,
      isActive: true,
    });
    return this.tierRepo.upsert(tier);
  }
}
