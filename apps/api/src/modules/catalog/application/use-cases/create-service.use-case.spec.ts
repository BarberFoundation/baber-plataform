import { CreateServiceUseCase, CreateServiceInput } from './create-service.use-case';
import { ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { Service } from '../../domain/entities/service.entity';
import { ServiceNameTakenError } from '../../domain/errors/catalog.errors';

function makeRepo(overrides?: Partial<ICatalogRepository>): ICatalogRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    existsByName: jest.fn().mockResolvedValue(false),
    save: jest.fn().mockImplementation(async (s: Service) => s),
    ...overrides,
  };
}

const INPUT: CreateServiceInput = {
  tenantId: 'tenant-1',
  name: 'Corte Masculino',
  description: 'Corte clássico',
  priceInCents: 3500,
  durationMinutes: 30,
};

describe('CreateServiceUseCase', () => {
  it('creates and saves a new service when name is unique', async () => {
    const repo = makeRepo();
    const uc = new CreateServiceUseCase(repo);
    const result = await uc.execute(INPUT);
    expect(result.name).toBe('Corte Masculino');
    expect(result.tenantId).toBe('tenant-1');
    expect(result.isActive).toBe(true);
    expect(repo.existsByName).toHaveBeenCalledWith('Corte Masculino', 'tenant-1');
    expect(repo.save).toHaveBeenCalledWith(expect.any(Service));
  });

  it('throws ServiceNameTakenError when name already exists in tenant', async () => {
    const repo = makeRepo({ existsByName: jest.fn().mockResolvedValue(true) });
    const uc = new CreateServiceUseCase(repo);
    await expect(uc.execute(INPUT)).rejects.toBeInstanceOf(ServiceNameTakenError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('sets description to null when omitted', async () => {
    const repo = makeRepo();
    const uc = new CreateServiceUseCase(repo);
    const result = await uc.execute({ ...INPUT, description: undefined });
    expect(result.description).toBeNull();
  });
});
