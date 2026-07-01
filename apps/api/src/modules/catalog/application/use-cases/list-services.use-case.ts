import { Injectable, Inject } from '@nestjs/common';
import { CATALOG_REPOSITORY, ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { Service } from '../../domain/entities/service.entity';

export interface ListServicesInput {
  tenantId: string;
  includeInactive: boolean;
}

@Injectable()
export class ListServicesUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly repo: ICatalogRepository,
  ) {}

  async execute(input: ListServicesInput): Promise<Service[]> {
    return this.repo.findAll(input.tenantId, input.includeInactive);
  }
}
