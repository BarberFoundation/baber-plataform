import { UpdateSubscriptionTierUseCase } from './update-subscription-tier.use-case';
import { SubscriptionTierNotFoundError, SubscriptionTierNameTakenError } from '../../domain/errors/loyalty.errors';

describe('UpdateSubscriptionTierUseCase', () => {
  const existingCreatedAt = new Date('2026-01-01');
  function makeExisting(overrides: Record<string, unknown> = {}) {
    return {
      id: 'tier-1', tenantId: 't1', name: 'Essencial', createdAt: existingCreatedAt,
      services: [{ serviceId: 'svc-1', quantity: 1 }], discountPercentage: 10, isActive: true,
      updatedAt: existingCreatedAt,
      ...overrides,
    };
  }

  it('updates name/services/discount, preserving id/createdAt/isActive', async () => {
    const existing = makeExisting();
    const tierRepo = {
      findById: jest.fn().mockResolvedValue(existing),
      findByTenantIdAndName: jest.fn().mockResolvedValue(null),
      upsert: jest.fn((t) => t),
    };
    const useCase = new UpdateSubscriptionTierUseCase(tierRepo as never);

    const result = await useCase.execute({
      tenantId: 't1', id: 'tier-1', name: 'Essencial Plus',
      services: [{ serviceId: 'svc-1', quantity: 2 }], discountPercentage: 20,
    });

    expect(tierRepo.findById).toHaveBeenCalledWith('tier-1', 't1');
    const saved = tierRepo.upsert.mock.calls[0][0];
    expect(saved.id).toBe('tier-1');
    expect(saved.createdAt).toBe(existingCreatedAt);
    expect(saved.name).toBe('Essencial Plus');
    expect(saved.discountPercentage).toBe(20);
    expect(saved.isActive).toBe(true);
    expect(result.name).toBe('Essencial Plus');
  });

  it('throws SubscriptionTierNotFoundError when the id does not exist for the tenant', async () => {
    const tierRepo = { findById: jest.fn().mockResolvedValue(null), findByTenantIdAndName: jest.fn(), upsert: jest.fn() };
    const useCase = new UpdateSubscriptionTierUseCase(tierRepo as never);
    await expect(useCase.execute({
      tenantId: 't1', id: 'missing', name: 'X', services: [{ serviceId: 'svc-1', quantity: 1 }], discountPercentage: 0,
    })).rejects.toThrow(SubscriptionTierNotFoundError);
  });

  it('throws SubscriptionTierNameTakenError when renaming to a name used by a different tier', async () => {
    const existing = makeExisting();
    const otherTierWithSameName = makeExisting({ id: 'tier-2', name: 'Ouro' });
    const tierRepo = {
      findById: jest.fn().mockResolvedValue(existing),
      findByTenantIdAndName: jest.fn().mockResolvedValue(otherTierWithSameName),
      upsert: jest.fn(),
    };
    const useCase = new UpdateSubscriptionTierUseCase(tierRepo as never);

    await expect(useCase.execute({
      tenantId: 't1', id: 'tier-1', name: 'Ouro', services: [{ serviceId: 'svc-1', quantity: 1 }], discountPercentage: 0,
    })).rejects.toThrow(SubscriptionTierNameTakenError);
  });

  it('allows keeping the same name on update (no self-conflict)', async () => {
    const existing = makeExisting();
    const tierRepo = {
      findById: jest.fn().mockResolvedValue(existing),
      findByTenantIdAndName: jest.fn().mockResolvedValue(existing), // name resolves to itself
      upsert: jest.fn((t) => t),
    };
    const useCase = new UpdateSubscriptionTierUseCase(tierRepo as never);

    await expect(useCase.execute({
      tenantId: 't1', id: 'tier-1', name: 'Essencial', services: [{ serviceId: 'svc-1', quantity: 1 }], discountPercentage: 10,
    })).resolves.toBeDefined();
  });
});
