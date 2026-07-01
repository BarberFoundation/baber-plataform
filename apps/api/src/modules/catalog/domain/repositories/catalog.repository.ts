import { Service } from '../entities/service.entity';

export const CATALOG_REPOSITORY = Symbol('ICatalogRepository');

export interface ICatalogRepository {
  findById(id: string, tenantId: string): Promise<Service | null>;
  findAll(tenantId: string, includeInactive: boolean): Promise<Service[]>;
  existsByName(name: string, tenantId: string, excludeId?: string): Promise<boolean>;
  save(service: Service): Promise<Service>;
}
