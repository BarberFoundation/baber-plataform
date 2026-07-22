// apps/api/src/modules/loyalty/application/use-cases/get-available-subscription-tiers.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import {
  SUBSCRIPTION_TIER_REPOSITORY,
  ISubscriptionTierRepository,
} from '../../domain/repositories/subscription-tier.repository';
import { CATALOG_REPOSITORY, ICatalogRepository } from '../../../catalog/domain/repositories/catalog.repository';
import { SubscriptionTierName } from '../../domain/entities/subscription-tier.entity';

export interface GetAvailableSubscriptionTiersInput {
  tenantId: string;
}

export interface AvailableSubscriptionTierServiceView {
  serviceId: string;
  quantity: number;
  priceInCents: number;
}

export interface AvailableSubscriptionTierView {
  id: string;
  tier: SubscriptionTierName;
  services: AvailableSubscriptionTierServiceView[];
  monthlyPriceInCents: number;
  discountPercentage: number;
}

@Injectable()
export class GetAvailableSubscriptionTiersUseCase {
  constructor(
    @Inject(SUBSCRIPTION_TIER_REPOSITORY) private readonly tierRepo: ISubscriptionTierRepository,
    @Inject(CATALOG_REPOSITORY) private readonly catalogRepo: ICatalogRepository,
  ) {}

  async execute(input: GetAvailableSubscriptionTiersInput): Promise<AvailableSubscriptionTierView[]> {
    const tiers = await this.tierRepo.findByTenantId(input.tenantId);
    const activeTiers = tiers.filter((t) => t.isActive);

    const views: AvailableSubscriptionTierView[] = [];
    for (const tier of activeTiers) {
      const catalogPrices = new Map<string, number>();
      const services: AvailableSubscriptionTierServiceView[] = [];
      for (const item of tier.services) {
        const service = await this.catalogRepo.findById(item.serviceId, input.tenantId);
        if (service) {
          catalogPrices.set(item.serviceId, service.priceInCents);
          services.push({ serviceId: item.serviceId, quantity: item.quantity, priceInCents: service.priceInCents });
        }
      }
      views.push({
        id: tier.id,
        tier: tier.tier,
        services,
        monthlyPriceInCents: tier.calculatePriceInCents(catalogPrices, { tolerateMissing: true }),
        discountPercentage: tier.discountPercentage,
      });
    }
    return views;
  }
}
