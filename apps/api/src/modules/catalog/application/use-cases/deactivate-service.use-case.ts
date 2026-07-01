import { Injectable, Inject } from '@nestjs/common';
import { CATALOG_REPOSITORY, ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { ServiceNotFoundError } from '../../domain/errors/catalog.errors';

export interface DeactivateServiceInput {
  id: string;
  tenantId: string;
}

@Injectable()
export class DeactivateServiceUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly repo: ICatalogRepository,
  ) {}

  async execute(input: DeactivateServiceInput): Promise<void> {
    const service = await this.repo.findById(input.id, input.tenantId);
    if (!service) throw new ServiceNotFoundError();
    service.deactivate();
    await this.repo.save(service);
  }
}
