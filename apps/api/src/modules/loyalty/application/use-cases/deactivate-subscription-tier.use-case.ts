import { Inject, Injectable } from '@nestjs/common';
import {
  SUBSCRIPTION_TIER_REPOSITORY,
  ISubscriptionTierRepository,
} from '../../domain/repositories/subscription-tier.repository';
import { SubscriptionTier } from '../../domain/entities/subscription-tier.entity';
import { SubscriptionTierNotFoundError } from '../../domain/errors/loyalty.errors';

export interface DeactivateSubscriptionTierInput {
  tenantId: string;
  id: string;
}

@Injectable()
export class DeactivateSubscriptionTierUseCase {
  constructor(
    @Inject(SUBSCRIPTION_TIER_REPOSITORY) private readonly tierRepo: ISubscriptionTierRepository,
  ) {}

  async execute(input: DeactivateSubscriptionTierInput): Promise<void> {
    const existing = await this.tierRepo.findById(input.id, input.tenantId);
    if (!existing) throw new SubscriptionTierNotFoundError();

    const updated = SubscriptionTier.create({
      id: existing.id,
      createdAt: existing.createdAt,
      tenantId: existing.tenantId,
      name: existing.name,
      services: existing.services,
      discountPercentage: existing.discountPercentage,
      isActive: false,
    });
    await this.tierRepo.upsert(updated);
  }
}
