import { UpsertSubscriptionTierUseCase } from './upsert-subscription-tier.use-case';

describe('UpsertSubscriptionTierUseCase', () => {
  it('creates a new tier when none exists yet', async () => {
    const tierRepo = { findByTenantIdAndTier: jest.fn().mockResolvedValue(null), upsert: jest.fn((t) => t) };
    const useCase = new UpsertSubscriptionTierUseCase(tierRepo as never);

    const result = await useCase.execute({
      tenantId: 't1', tier: 'ESSENCIAL',
      services: [{ serviceId: 'svc-1', quantity: 2 }],
      discountPercentage: 15, isActive: true,
    });

    expect(tierRepo.upsert).toHaveBeenCalled();
    expect(result.tier).toBe('ESSENCIAL');
  });

  it('preserves id/createdAt when a tier already exists', async () => {
    const existingCreatedAt = new Date('2026-01-01');
    const existing = {
      id: 'tier-1', tenantId: 't1', tier: 'ESSENCIAL', createdAt: existingCreatedAt,
      services: [], discountPercentage: 10, isActive: true, updatedAt: existingCreatedAt,
    };
    const tierRepo = {
      findByTenantIdAndTier: jest.fn().mockResolvedValue(existing),
      upsert: jest.fn((t) => t),
    };
    const useCase = new UpsertSubscriptionTierUseCase(tierRepo as never);

    await useCase.execute({
      tenantId: 't1', tier: 'ESSENCIAL',
      services: [{ serviceId: 'svc-1', quantity: 2 }],
      discountPercentage: 20, isActive: true,
    });

    const savedEntity = tierRepo.upsert.mock.calls[0][0];
    expect(savedEntity.id).toBe('tier-1');
    expect(savedEntity.createdAt).toBe(existingCreatedAt);
  });
});
