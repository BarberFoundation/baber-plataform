// apps/api/src/modules/loyalty/application/use-cases/get-available-subscription-tiers.use-case.spec.ts
import { GetAvailableSubscriptionTiersUseCase } from './get-available-subscription-tiers.use-case';
import { SubscriptionTier } from '../../domain/entities/subscription-tier.entity';

describe('GetAvailableSubscriptionTiersUseCase', () => {
  function makeTier(overrides: { tier: 'ESSENCIAL' | 'JOGADOR' | 'LENDARIO'; isActive: boolean; discountPercentage?: number }) {
    return SubscriptionTier.create({
      tenantId: 't1',
      tier: overrides.tier,
      services: [{ serviceId: 'svc-1', quantity: 2 }],
      discountPercentage: overrides.discountPercentage ?? 0,
      isActive: overrides.isActive,
    });
  }

  it('returns only active tiers, with id, computed price and per-service price', async () => {
    const active = makeTier({ tier: 'ESSENCIAL', isActive: true, discountPercentage: 10 });
    const inactive = makeTier({ tier: 'JOGADOR', isActive: false });
    const tierRepo = { findByTenantId: jest.fn().mockResolvedValue([active, inactive]) };
    const catalogRepo = { findById: jest.fn().mockResolvedValue({ priceInCents: 5000 }) };
    const useCase = new GetAvailableSubscriptionTiersUseCase(tierRepo as never, catalogRepo as never);

    const result = await useCase.execute({ tenantId: 't1' });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: active.id,
      tier: 'ESSENCIAL',
      services: [{ serviceId: 'svc-1', quantity: 2, priceInCents: 5000 }],
      monthlyPriceInCents: 9000, // 2 * 5000 = 10000, -10% = 9000
      discountPercentage: 10,
    });
    expect(catalogRepo.findById).toHaveBeenCalledWith('svc-1', 't1');
  });

  it('excludes a tier service that no longer exists in the catalog from the price calculation', async () => {
    const tier = SubscriptionTier.create({
      tenantId: 't1',
      tier: 'ESSENCIAL',
      services: [{ serviceId: 'svc-deleted', quantity: 1 }],
      discountPercentage: 0,
      isActive: true,
    });
    const tierRepo = { findByTenantId: jest.fn().mockResolvedValue([tier]) };
    const catalogRepo = { findById: jest.fn().mockResolvedValue(null) };
    const useCase = new GetAvailableSubscriptionTiersUseCase(tierRepo as never, catalogRepo as never);

    const result = await useCase.execute({ tenantId: 't1' });

    expect(result[0].services).toEqual([]);
    expect(result[0].monthlyPriceInCents).toBe(0);
  });

  it('returns an empty array when there are no active tiers', async () => {
    const tierRepo = { findByTenantId: jest.fn().mockResolvedValue([]) };
    const catalogRepo = { findById: jest.fn() };
    const useCase = new GetAvailableSubscriptionTiersUseCase(tierRepo as never, catalogRepo as never);

    const result = await useCase.execute({ tenantId: 't1' });

    expect(result).toEqual([]);
    expect(catalogRepo.findById).not.toHaveBeenCalled();
  });
});
