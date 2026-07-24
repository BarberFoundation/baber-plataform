import { DeactivateSubscriptionTierUseCase } from './deactivate-subscription-tier.use-case';
import { SubscriptionTierNotFoundError } from '../../domain/errors/loyalty.errors';

describe('DeactivateSubscriptionTierUseCase', () => {
  it('sets isActive to false and saves', async () => {
    const existing = {
      id: 'tier-1', tenantId: 't1', name: 'Essencial', createdAt: new Date(),
      services: [{ serviceId: 'svc-1', quantity: 1 }], discountPercentage: 10, isActive: true,
    };
    const tierRepo = { findById: jest.fn().mockResolvedValue(existing), upsert: jest.fn((t) => t) };
    const useCase = new DeactivateSubscriptionTierUseCase(tierRepo as never);

    await useCase.execute({ tenantId: 't1', id: 'tier-1' });

    const saved = tierRepo.upsert.mock.calls[0][0];
    expect(saved.isActive).toBe(false);
    expect(saved.id).toBe('tier-1');
  });

  it('throws SubscriptionTierNotFoundError when the id does not exist for the tenant', async () => {
    const tierRepo = { findById: jest.fn().mockResolvedValue(null), upsert: jest.fn() };
    const useCase = new DeactivateSubscriptionTierUseCase(tierRepo as never);
    await expect(useCase.execute({ tenantId: 't1', id: 'missing' })).rejects.toThrow(SubscriptionTierNotFoundError);
    expect(tierRepo.upsert).not.toHaveBeenCalled();
  });
});
