import { Inject, Injectable } from '@nestjs/common';
import {
  SUBSCRIPTION_TIER_REPOSITORY,
  ISubscriptionTierRepository,
} from '../../domain/repositories/subscription-tier.repository';
import { SubscriptionTier, SubscriptionTierServiceItem } from '../../domain/entities/subscription-tier.entity';
import { SubscriptionTierNotFoundError, SubscriptionTierNameTakenError } from '../../domain/errors/loyalty.errors';

export interface UpdateSubscriptionTierInput {
  tenantId: string;
  id: string;
  name: string;
  services: SubscriptionTierServiceItem[];
  discountPercentage: number;
}

@Injectable()
export class UpdateSubscriptionTierUseCase {
  constructor(
    @Inject(SUBSCRIPTION_TIER_REPOSITORY) private readonly tierRepo: ISubscriptionTierRepository,
  ) {}

  async execute(input: UpdateSubscriptionTierInput): Promise<SubscriptionTier> {
    const existing = await this.tierRepo.findById(input.id, input.tenantId);
    if (!existing) throw new SubscriptionTierNotFoundError();

    const nameOwner = await this.tierRepo.findByTenantIdAndName(input.tenantId, input.name);
    if (nameOwner && nameOwner.id !== existing.id) throw new SubscriptionTierNameTakenError();

    const updated = SubscriptionTier.create({
      id: existing.id,
      createdAt: existing.createdAt,
      tenantId: input.tenantId,
      name: input.name,
      services: input.services,
      discountPercentage: input.discountPercentage,
      isActive: existing.isActive,
    });
    return this.tierRepo.upsert(updated);
  }
}
