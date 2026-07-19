import { GetMyStampCardUseCase } from './get-my-stamp-card.use-case';
import { StampCard } from '../../domain/entities/stamp-card.entity';
import { StampCardConfig } from '../../domain/entities/stamp-card-config.entity';

describe('GetMyStampCardUseCase', () => {
  it('returns the card progress and the tenant stampsRequired when both exist', async () => {
    const card = StampCard.createNew('t1', 'client-1');
    // Completing the card resets currentStamps to 0 and credits the balance.
    // Uses a threshold of 1 here (independent of the tenant config's stampsRequired
    // below) purely to drive the card into that post-completion state.
    card.addStamp(1, 5000);
    const config = StampCardConfig.create({
      tenantId: 't1',
      eligibleServiceIds: ['svc-1'],
      stampsRequired: 10,
      creditValueInCents: 5000,
      isActive: true,
    });
    const cardRepo = { findByClientId: jest.fn().mockResolvedValue(card) };
    const configRepo = { findByTenantId: jest.fn().mockResolvedValue(config) };
    const useCase = new GetMyStampCardUseCase(cardRepo as never, configRepo as never);

    const result = await useCase.execute({ tenantId: 't1', clientId: 'client-1' });

    expect(result).toEqual({
      currentStamps: 0,
      stampsRequired: 10,
      creditBalanceInCents: 5000,
    });
  });

  it('returns a zero-state view when the client has no card yet', async () => {
    const config = StampCardConfig.create({
      tenantId: 't1',
      eligibleServiceIds: ['svc-1'],
      stampsRequired: 10,
      creditValueInCents: 5000,
      isActive: true,
    });
    const cardRepo = { findByClientId: jest.fn().mockResolvedValue(null) };
    const configRepo = { findByTenantId: jest.fn().mockResolvedValue(config) };
    const useCase = new GetMyStampCardUseCase(cardRepo as never, configRepo as never);

    const result = await useCase.execute({ tenantId: 't1', clientId: 'client-1' });

    expect(result).toEqual({
      currentStamps: 0,
      stampsRequired: 10,
      creditBalanceInCents: 0,
    });
  });

  it('returns stampsRequired null when the tenant has no config at all', async () => {
    const cardRepo = { findByClientId: jest.fn().mockResolvedValue(null) };
    const configRepo = { findByTenantId: jest.fn().mockResolvedValue(null) };
    const useCase = new GetMyStampCardUseCase(cardRepo as never, configRepo as never);

    const result = await useCase.execute({ tenantId: 't1', clientId: 'client-1' });

    expect(result).toEqual({
      currentStamps: 0,
      stampsRequired: null,
      creditBalanceInCents: 0,
    });
  });
});
