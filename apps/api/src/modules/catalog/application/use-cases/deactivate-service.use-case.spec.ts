import { DeactivateServiceUseCase } from './deactivate-service.use-case';
import { ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { Service } from '../../domain/entities/service.entity';
import { ServiceNotFoundError } from '../../domain/errors/catalog.errors';

const ACTIVE_SERVICE = Service.reconstitute({
  id: 'svc-id-1',
  tenantId: 'tenant-1',
  name: 'Corte Masculino',
  description: null,
  priceInCents: 3500,
  durationMinutes: 30,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

function makeRepo(existing: Service | null = ACTIVE_SERVICE): ICatalogRepository {
  return {
    findById: jest.fn().mockResolvedValue(existing),
    findAll: jest.fn().mockResolvedValue([]),
    existsByName: jest.fn().mockResolvedValue(false),
    save: jest.fn().mockImplementation(async (s: Service) => s),
  };
}

describe('DeactivateServiceUseCase', () => {
  it('deactivates service and saves', async () => {
    const repo = makeRepo();
    const uc = new DeactivateServiceUseCase(repo);
    await uc.execute({ id: 'svc-id-1', tenantId: 'tenant-1' });
    const savedService = (repo.save as jest.Mock).mock.calls[0][0] as Service;
    expect(savedService.isActive).toBe(false);
  });

  it('throws ServiceNotFoundError when service does not exist', async () => {
    const repo = makeRepo(null);
    const uc = new DeactivateServiceUseCase(repo);
    await expect(
      uc.execute({ id: 'missing-id', tenantId: 'tenant-1' }),
    ).rejects.toBeInstanceOf(ServiceNotFoundError);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
