import { CreateSubscriptionTierUseCase } from './create-subscription-tier.use-case';
import { SubscriptionTierNameTakenError } from '../../domain/errors/loyalty.errors';

describe('CreateSubscriptionTierUseCase', () => {
  it('creates a new tier with isActive true', async () => {
    const tierRepo = { findByTenantIdAndName: jest.fn().mockResolvedValue(null), upsert: jest.fn((t) => t) };
    const useCase = new CreateSubscriptionTierUseCase(tierRepo as never);

    const result = await useCase.execute({
      tenantId: 't1', name: 'Ouro',
      services: [{ serviceId: 'svc-1', quantity: 2 }],
      discountPercentage: 15,
    });

    expect(tierRepo.upsert).toHaveBeenCalled();
    expect(result.name).toBe('Ouro');
    expect(result.isActive).toBe(true);
  });

  it('throws SubscriptionTierNameTakenError when the name is already used in the tenant', async () => {
    const tierRepo = {
      findByTenantIdAndName: jest.fn().mockResolvedValue({ id: 'existing' }),
      upsert: jest.fn(),
    };
    const useCase = new CreateSubscriptionTierUseCase(tierRepo as never);

    await expect(useCase.execute({
      tenantId: 't1', name: 'Ouro',
      services: [{ serviceId: 'svc-1', quantity: 2 }],
      discountPercentage: 15,
    })).rejects.toThrow(SubscriptionTierNameTakenError);
    expect(tierRepo.upsert).not.toHaveBeenCalled();
  });
});
