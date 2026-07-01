import { Injectable, Inject } from '@nestjs/common';
import { CATALOG_REPOSITORY, ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { Service } from '../../domain/entities/service.entity';
import { ServiceNameTakenError } from '../../domain/errors/catalog.errors';

export interface CreateServiceInput {
  tenantId: string;
  name: string;
  description?: string | null;
  priceInCents: number;
  durationMinutes: number;
}

@Injectable()
export class CreateServiceUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly repo: ICatalogRepository,
  ) {}

  async execute(input: CreateServiceInput): Promise<Service> {
    const nameTaken = await this.repo.existsByName(input.name, input.tenantId);
    if (nameTaken) throw new ServiceNameTakenError();

    const service = Service.create({
      tenantId: input.tenantId,
      name: input.name,
      description: input.description ?? null,
      priceInCents: input.priceInCents,
      durationMinutes: input.durationMinutes,
    });

    return this.repo.save(service);
  }
}
