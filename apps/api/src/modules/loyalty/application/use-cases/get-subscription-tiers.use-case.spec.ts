import { GetSubscriptionTiersUseCase } from './get-subscription-tiers.use-case';

describe('GetSubscriptionTiersUseCase', () => {
  it('returns all tiers for the tenant', async () => {
    const tierRepo = { findByTenantId: jest.fn().mockResolvedValue([{ name: 'Essencial' }, { name: 'Ouro' }]) };
    const useCase = new GetSubscriptionTiersUseCase(tierRepo as never);
    const result = await useCase.execute({ tenantId: 't1' });
    expect(result).toHaveLength(2);
    expect(tierRepo.findByTenantId).toHaveBeenCalledWith('t1');
  });
});
