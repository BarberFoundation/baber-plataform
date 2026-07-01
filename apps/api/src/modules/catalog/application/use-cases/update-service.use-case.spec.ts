import { UpdateServiceUseCase, UpdateServiceInput } from './update-service.use-case';
import { ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { Service } from '../../domain/entities/service.entity';
import { ServiceNotFoundError, ServiceNameTakenError } from '../../domain/errors/catalog.errors';

function createExisting(): Service {
  return Service.reconstitute({
    id: 'svc-id-1',
    tenantId: 'tenant-1',
    name: 'Corte Masculino',
    description: null,
    priceInCents: 3500,
    durationMinutes: 30,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  });
}

function makeRepo(existing: Service | null = createExisting(), nameTaken = false): ICatalogRepository {
  return {
    findById: jest.fn().mockResolvedValue(existing),
    findAll: jest.fn().mockResolvedValue([]),
    existsByName: jest.fn().mockResolvedValue(nameTaken),
    save: jest.fn().mockImplementation(async (s: Service) => s),
  };
}

const INPUT: UpdateServiceInput = {
  id: 'svc-id-1',
  tenantId: 'tenant-1',
  name: 'Corte + Barba',
  description: 'Pacote completo',
  priceInCents: 5500,
  durationMinutes: 45,
};

describe('UpdateServiceUseCase', () => {
  it('updates service fields and saves when name is unique', async () => {
    const repo = makeRepo();
    const uc = new UpdateServiceUseCase(repo);
    const result = await uc.execute(INPUT);
    expect(result.name).toBe('Corte + Barba');
    expect(result.priceInCents).toBe(5500);
    expect(result.durationMinutes).toBe(45);
    expect(result.description).toBe('Pacote completo');
    expect(repo.save).toHaveBeenCalled();
  });

  it('skips name-uniqueness check when name has not changed', async () => {
    const repo = makeRepo();
    const uc = new UpdateServiceUseCase(repo);
    await uc.execute({ ...INPUT, name: 'Corte Masculino' });
    expect(repo.existsByName).not.toHaveBeenCalled();
  });

  it('checks name uniqueness with excludeId when name changed', async () => {
    const repo = makeRepo();
    const uc = new UpdateServiceUseCase(repo);
    await uc.execute(INPUT);
    expect(repo.existsByName).toHaveBeenCalledWith('Corte + Barba', 'tenant-1', 'svc-id-1');
  });

  it('throws ServiceNameTakenError when new name conflicts with another service', async () => {
    const repo = makeRepo(createExisting(), true);
    const uc = new UpdateServiceUseCase(repo);
    await expect(uc.execute(INPUT)).rejects.toBeInstanceOf(ServiceNameTakenError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('throws ServiceNotFoundError when service does not exist', async () => {
    const repo = makeRepo(null);
    const uc = new UpdateServiceUseCase(repo);
    await expect(uc.execute(INPUT)).rejects.toBeInstanceOf(ServiceNotFoundError);
  });
});
