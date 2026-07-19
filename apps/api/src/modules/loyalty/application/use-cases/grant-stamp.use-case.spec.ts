import { GrantStampUseCase } from './grant-stamp.use-case';
import { StampCard } from '../../domain/entities/stamp-card.entity';
import { StampCardConfig } from '../../domain/entities/stamp-card-config.entity';

function makeConfig(overrides: Partial<{ eligibleServiceIds: string[]; stampsRequired: number; creditValueInCents: number; isActive: boolean }> = {}) {
  return StampCardConfig.create({
    tenantId: 't1',
    eligibleServiceIds: ['svc-1'],
    stampsRequired: 2,
    creditValueInCents: 5000,
    isActive: true,
    ...overrides,
  });
}

describe('GrantStampUseCase', () => {
  it('does nothing when the tenant has no stamp card config', async () => {
    const cardRepo = { findByClientId: jest.fn(), save: jest.fn() };
    const configRepo = { findByTenantId: jest.fn().mockResolvedValue(null) };
    const emit = jest.fn();
    const useCase = new GrantStampUseCase(cardRepo as never, configRepo as never, { emit } as never);

    await useCase.execute({ tenantId: 't1', clientId: 'client-1', serviceId: 'svc-1' });

    expect(cardRepo.save).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('does nothing when the completed service is not eligible', async () => {
    const cardRepo = { findByClientId: jest.fn(), save: jest.fn() };
    const configRepo = { findByTenantId: jest.fn().mockResolvedValue(makeConfig()) };
    const emit = jest.fn();
    const useCase = new GrantStampUseCase(cardRepo as never, configRepo as never, { emit } as never);

    await useCase.execute({ tenantId: 't1', clientId: 'client-1', serviceId: 'svc-not-eligible' });

    expect(cardRepo.save).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('creates a new card, adds a stamp, saves it and emits STAMP_ADDED', async () => {
    const cardRepo = { findByClientId: jest.fn().mockResolvedValue(null), save: jest.fn((c) => Promise.resolve(c)) };
    const configRepo = { findByTenantId: jest.fn().mockResolvedValue(makeConfig()) };
    const emit = jest.fn();
    const useCase = new GrantStampUseCase(cardRepo as never, configRepo as never, { emit } as never);

    await useCase.execute({ tenantId: 't1', clientId: 'client-1', serviceId: 'svc-1' });

    expect(cardRepo.save).toHaveBeenCalledWith(expect.any(StampCard));
    expect(emit).toHaveBeenCalledWith(
      'loyalty.stamp_card.stamp_added',
      expect.objectContaining({ tenantId: 't1', clientId: 'client-1', currentStamps: 1, stampsRequired: 2 }),
    );
  });

  it('emits STAMP_CARD_COMPLETED in addition to STAMP_ADDED when the threshold is reached', async () => {
    const existing = StampCard.createNew('t1', 'client-1');
    existing.addStamp(2, 5000); // one stamp already, threshold=2
    const cardRepo = { findByClientId: jest.fn().mockResolvedValue(existing), save: jest.fn((c) => Promise.resolve(c)) };
    const configRepo = { findByTenantId: jest.fn().mockResolvedValue(makeConfig()) };
    const emit = jest.fn();
    const useCase = new GrantStampUseCase(cardRepo as never, configRepo as never, { emit } as never);

    await useCase.execute({ tenantId: 't1', clientId: 'client-1', serviceId: 'svc-1' });

    expect(emit).toHaveBeenCalledWith('loyalty.stamp_card.stamp_added', expect.any(Object));
    expect(emit).toHaveBeenCalledWith(
      'loyalty.stamp_card.completed',
      expect.objectContaining({ tenantId: 't1', clientId: 'client-1', creditEarnedInCents: 5000 }),
    );
  });
});
