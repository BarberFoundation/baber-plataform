import { Injectable, Inject } from '@nestjs/common';
import { CATALOG_REPOSITORY, ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { Service } from '../../domain/entities/service.entity';
import { ServiceNotFoundError, ServiceNameTakenError } from '../../domain/errors/catalog.errors';

export interface UpdateServiceInput {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  priceInCents: number;
  durationMinutes: number;
}

@Injectable()
export class UpdateServiceUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly repo: ICatalogRepository,
  ) {}

  async execute(input: UpdateServiceInput): Promise<Service> {
    const service = await this.repo.findById(input.id, input.tenantId);
    if (!service) throw new ServiceNotFoundError();

    const nameChanged = input.name !== service.name;
    if (nameChanged) {
      const nameTaken = await this.repo.existsByName(input.name, input.tenantId, input.id);
      if (nameTaken) throw new ServiceNameTakenError();
    }

    service.update(input.name, input.description ?? null, input.priceInCents, input.durationMinutes);
    return this.repo.save(service);
  }
}
