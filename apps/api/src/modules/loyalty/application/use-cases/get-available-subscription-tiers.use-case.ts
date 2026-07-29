// apps/api/src/modules/loyalty/application/use-cases/get-available-subscription-tiers.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import {
  SUBSCRIPTION_TIER_REPOSITORY,
  ISubscriptionTierRepository,
} from '../../domain/repositories/subscription-tier.repository';
import { SERVICE_PRICE_LOOKUP, IServicePriceLookup } from '../../domain/ports/service-price-lookup.port';

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
  name: string;
  services: AvailableSubscriptionTierServiceView[];
  monthlyPriceInCents: number;
  discountPercentage: number;
}

@Injectable()
export class GetAvailableSubscriptionTiersUseCase {
  constructor(
    @Inject(SUBSCRIPTION_TIER_REPOSITORY) private readonly tierRepo: ISubscriptionTierRepository,
    @Inject(SERVICE_PRICE_LOOKUP) private readonly priceLookup: IServicePriceLookup,
  ) {}

  async execute(input: GetAvailableSubscriptionTiersInput): Promise<AvailableSubscriptionTierView[]> {
    const tiers = await this.tierRepo.findByTenantId(input.tenantId);
    const activeTiers = tiers.filter((t) => t.isActive);

    const views: AvailableSubscriptionTierView[] = [];
    for (const tier of activeTiers) {
      const catalogPrices = new Map<string, number>();
      const services: AvailableSubscriptionTierServiceView[] = [];
      for (const item of tier.services) {
        const priceInCents = await this.priceLookup.findPriceInCents(item.serviceId, input.tenantId);
        if (priceInCents !== null) {
          catalogPrices.set(item.serviceId, priceInCents);
          services.push({ serviceId: item.serviceId, quantity: item.quantity, priceInCents });
        }
      }
      views.push({
        id: tier.id,
        name: tier.name,
        services,
        monthlyPriceInCents: tier.calculatePriceInCents(catalogPrices, { tolerateMissing: true }),
        discountPercentage: tier.discountPercentage,
      });
    }
    return views;
  }
}
