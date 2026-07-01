import { GetServiceUseCase } from './get-service.use-case';
import { ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { Service } from '../../domain/entities/service.entity';
import { ServiceNotFoundError } from '../../domain/errors/catalog.errors';

const EXISTING = Service.reconstitute({
  id: 'svc-id-1',
  tenantId: 'tenant-1',
  name: 'Corte Masculino',
  description: 'Descrição',
  priceInCents: 3500,
  durationMinutes: 30,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

function makeRepo(existing: Service | null = EXISTING): ICatalogRepository {
  return {
    findById: jest.fn().mockResolvedValue(existing),
    findAll: jest.fn().mockResolvedValue([]),
    existsByName: jest.fn().mockResolvedValue(false),
    save: jest.fn().mockResolvedValue(EXISTING),
  };
}

describe('GetServiceUseCase', () => {
  it('returns the service when it exists', async () => {
    const repo = makeRepo();
    const uc = new GetServiceUseCase(repo);
    const result = await uc.execute({ id: 'svc-id-1', tenantId: 'tenant-1' });
    expect(result.id).toBe('svc-id-1');
    expect(result.name).toBe('Corte Masculino');
    expect(repo.findById).toHaveBeenCalledWith('svc-id-1', 'tenant-1');
  });

  it('throws ServiceNotFoundError when service does not exist', async () => {
    const repo = makeRepo(null);
    const uc = new GetServiceUseCase(repo);
    await expect(
      uc.execute({ id: 'missing', tenantId: 'tenant-1' }),
    ).rejects.toBeInstanceOf(ServiceNotFoundError);
  });
});
