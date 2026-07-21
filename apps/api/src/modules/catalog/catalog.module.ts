import { Module } from '@nestjs/common';
import { DatabaseModule } from '@shared/database/database.module';
import { CATALOG_REPOSITORY } from './domain/repositories/catalog.repository';
import { CatalogDrizzleRepository } from './infra/repositories/catalog-drizzle.repository';
import { CreateServiceUseCase } from './application/use-cases/create-service.use-case';
import { UpdateServiceUseCase } from './application/use-cases/update-service.use-case';
import { DeactivateServiceUseCase } from './application/use-cases/deactivate-service.use-case';
import { GetServiceUseCase } from './application/use-cases/get-service.use-case';
import { ListServicesUseCase } from './application/use-cases/list-services.use-case';
import { CatalogController } from './http/catalog.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [CatalogController],
  providers: [
    { provide: CATALOG_REPOSITORY, useClass: CatalogDrizzleRepository },
    CreateServiceUseCase,
    UpdateServiceUseCase,
    DeactivateServiceUseCase,
    GetServiceUseCase,
    ListServicesUseCase,
  ],
  exports: [CATALOG_REPOSITORY],
})
export class CatalogModule {}
