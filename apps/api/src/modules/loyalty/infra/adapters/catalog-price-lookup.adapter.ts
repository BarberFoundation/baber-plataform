import { Inject, Injectable } from '@nestjs/common';
import { CATALOG_REPOSITORY, ICatalogRepository } from '../../../catalog/domain/repositories/catalog.repository';
import { IServicePriceLookup } from '../../domain/ports/service-price-lookup.port';

/** Only file in the loyalty module allowed to know about catalog's repository shape. */
@Injectable()
export class CatalogPriceLookupAdapter implements IServicePriceLookup {
  constructor(@Inject(CATALOG_REPOSITORY) private readonly catalogRepo: ICatalogRepository) {}

  async findPriceInCents(serviceId: string, tenantId: string): Promise<number | null> {
    const service = await this.catalogRepo.findById(serviceId, tenantId);
    return service ? service.priceInCents : null;
  }
}
