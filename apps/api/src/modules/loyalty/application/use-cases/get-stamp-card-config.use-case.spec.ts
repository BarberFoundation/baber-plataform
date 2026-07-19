import { GetStampCardConfigUseCase } from './get-stamp-card-config.use-case';
import { StampCardConfigNotFoundError } from '../../domain/errors/loyalty.errors';
import { StampCardConfig } from '../../domain/entities/stamp-card-config.entity';

describe('GetStampCardConfigUseCase', () => {
  it('returns the config when it exists', async () => {
    const config = StampCardConfig.create({
      tenantId: 't1',
      eligibleServiceIds: ['svc-1'],
      stampsRequired: 10,
      creditValueInCents: 5000,
      isActive: true,
    });
    const repo = { findByTenantId: jest.fn().mockResolvedValue(config) };
    const useCase = new GetStampCardConfigUseCase(repo as never);

    const result = await useCase.execute({ tenantId: 't1' });

    expect(result).toBe(config);
  });

  it('throws StampCardConfigNotFoundError when no config exists', async () => {
    const repo = { findByTenantId: jest.fn().mockResolvedValue(null) };
    const useCase = new GetStampCardConfigUseCase(repo as never);

    await expect(useCase.execute({ tenantId: 't1' })).rejects.toThrow(StampCardConfigNotFoundError);
  });
});
