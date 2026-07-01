import { Injectable, Inject } from '@nestjs/common';
import { CATALOG_REPOSITORY, ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { Service } from '../../domain/entities/service.entity';
import { ServiceNotFoundError } from '../../domain/errors/catalog.errors';

export interface GetServiceInput {
  id: string;
  tenantId: string;
}

@Injectable()
export class GetServiceUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly repo: ICatalogRepository,
  ) {}

  async execute(input: GetServiceInput): Promise<Service> {
    const service = await this.repo.findById(input.id, input.tenantId);
    if (!service) throw new ServiceNotFoundError();
    return service;
  }
}
