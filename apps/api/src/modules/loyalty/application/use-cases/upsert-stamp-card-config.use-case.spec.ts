import { UpsertStampCardConfigUseCase } from './upsert-stamp-card-config.use-case';
import { StampCardConfig } from '../../domain/entities/stamp-card-config.entity';

describe('UpsertStampCardConfigUseCase', () => {
  const validInput = {
    tenantId: 't1',
    eligibleServiceIds: ['svc-1'],
    stampsRequired: 10,
    creditValueInCents: 5000,
    isActive: true,
  };

  it('creates a new config when none exists for the tenant', async () => {
    const repo = {
      findByTenantId: jest.fn().mockResolvedValue(null),
      upsert: jest.fn((c) => Promise.resolve(c)),
    };
    const useCase = new UpsertStampCardConfigUseCase(repo as never);

    const result = await useCase.execute(validInput);

    expect(result.tenantId).toBe('t1');
    expect(repo.upsert).toHaveBeenCalledWith(expect.any(StampCardConfig));
  });

  it('preserves the id and createdAt of an existing config', async () => {
    const existing = StampCardConfig.reconstitute({
      id: 'cfg-1',
      tenantId: 't1',
      eligibleServiceIds: ['svc-old'],
      stampsRequired: 5,
      creditValueInCents: 1000,
      isActive: true,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    });
    const repo = {
      findByTenantId: jest.fn().mockResolvedValue(existing),
      upsert: jest.fn((c) => Promise.resolve(c)),
    };
    const useCase = new UpsertStampCardConfigUseCase(repo as never);

    const result = await useCase.execute(validInput);

    expect(result.id).toBe('cfg-1');
    expect(result.createdAt).toEqual(new Date('2026-01-01'));
    expect(result.eligibleServiceIds).toEqual(['svc-1']);
  });
});
