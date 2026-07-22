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
      const services: AvailableSubscriptionTierServiceView[] = [];
      let baseInCents = 0;
      for (const item of tier.services) {
        const service = await this.catalogRepo.findById(item.serviceId, input.tenantId);
        if (service) {
          services.push({ serviceId: item.serviceId, quantity: item.quantity, priceInCents: service.priceInCents });
          baseInCents += service.priceInCents * item.quantity;
        }
      }
      // Deliberately not calling tier.calculatePriceInCents() here: that method throws if ANY of the
      // tier's original services is missing from the catalog map, even when only a subset is missing.
      // For client-facing browsing we want to silently drop deleted services from the price instead of
      // failing the whole listing, so the discount math (base - round(base * discount / 100)) is
      // duplicated here using only the services actually found in the catalog.
      const monthlyPriceInCents = baseInCents - Math.round((baseInCents * tier.discountPercentage) / 100);
      views.push({
        id: tier.id,
        tier: tier.tier,
        services,
        monthlyPriceInCents,
        discountPercentage: tier.discountPercentage,
      });
    }
    return views;
  }
}
