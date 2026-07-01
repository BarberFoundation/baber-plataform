import { ListServicesUseCase } from './list-services.use-case';
import { ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { Service } from '../../domain/entities/service.entity';

const ACTIVE = Service.reconstitute({
  id: 'svc-1',
  tenantId: 'tenant-1',
  name: 'Corte Masculino',
  description: null,
  priceInCents: 3500,
  durationMinutes: 30,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const INACTIVE = Service.reconstitute({
  id: 'svc-2',
  tenantId: 'tenant-1',
  name: 'Hidratação',
  description: null,
  priceInCents: 2000,
  durationMinutes: 20,
  isActive: false,
  createdAt: new Date(),
  updatedAt: new Date(),
});

function makeRepo(services: Service[] = [ACTIVE, INACTIVE]): ICatalogRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockImplementation(async (_tenantId: string, includeInactive: boolean) =>
      includeInactive ? services : services.filter((s) => s.isActive),
    ),
    existsByName: jest.fn().mockResolvedValue(false),
    save: jest.fn().mockImplementation(async (s: Service) => s),
  };
}

describe('ListServicesUseCase', () => {
  it('returns only active services when includeInactive is false', async () => {
    const repo = makeRepo();
    const uc = new ListServicesUseCase(repo);
    const result = await uc.execute({ tenantId: 'tenant-1', includeInactive: false });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('svc-1');
    expect(repo.findAll).toHaveBeenCalledWith('tenant-1', false);
  });

  it('returns all services including inactive when includeInactive is true', async () => {
    const repo = makeRepo();
    const uc = new ListServicesUseCase(repo);
    const result = await uc.execute({ tenantId: 'tenant-1', includeInactive: true });
    expect(result).toHaveLength(2);
    expect(repo.findAll).toHaveBeenCalledWith('tenant-1', true);
  });

  it('returns empty array when tenant has no services', async () => {
    const repo = makeRepo([]);
    const uc = new ListServicesUseCase(repo);
    const result = await uc.execute({ tenantId: 'tenant-1', includeInactive: false });
    expect(result).toEqual([]);
  });
});
