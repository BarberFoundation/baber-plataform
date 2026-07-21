import { Inject, Injectable } from '@nestjs/common';
import {
  SUBSCRIPTION_TIER_REPOSITORY,
  ISubscriptionTierRepository,
} from '../../domain/repositories/subscription-tier.repository';
import { SubscriptionTier } from '../../domain/entities/subscription-tier.entity';

export interface GetSubscriptionTiersInput {
  tenantId: string;
}

@Injectable()
export class GetSubscriptionTiersUseCase {
  constructor(
    @Inject(SUBSCRIPTION_TIER_REPOSITORY) private readonly tierRepo: ISubscriptionTierRepository,
  ) {}

  async execute(input: GetSubscriptionTiersInput): Promise<SubscriptionTier[]> {
    return this.tierRepo.findByTenantId(input.tenantId);
  }
}
