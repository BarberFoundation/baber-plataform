// apps/api/src/modules/loyalty/application/use-cases/activate-club-subscription.use-case.spec.ts
import { ActivateClubSubscriptionUseCase } from './activate-club-subscription.use-case';
import { SubscriptionTier } from '../../domain/entities/subscription-tier.entity';
import {
  SubscriptionTierNotFoundError,
  ClubSubscriptionAlreadyActiveError,
  ClubSubscriptionBlockedByStampCardError,
} from '../../domain/errors/loyalty.errors';

describe('ActivateClubSubscriptionUseCase', () => {
  function makeTier() {
    return SubscriptionTier.create({
      tenantId: 't1', tier: 'ESSENCIAL',
      services: [{ serviceId: 'svc-1', quantity: 2 }],
      discountPercentage: 0, isActive: true,
    });
  }

  function makeDeps(overrides: Record<string, unknown> = {}) {
    return {
      tierRepo: { findByTenantIdAndTier: jest.fn().mockResolvedValue(makeTier()) },
      clubSubRepo: { findByClientId: jest.fn().mockResolvedValue(null), save: jest.fn((s) => s) },
      stampCardRepo: { findByClientId: jest.fn().mockResolvedValue(null) },
      catalogRepo: { findById: jest.fn().mockResolvedValue({ priceInCents: 3500 }) },
      paymentGateway: {
        createCustomer: jest.fn().mockResolvedValue({ customerId: 'cus_1' }),
        createOneOffCharge: jest.fn().mockResolvedValue({ paymentId: 'pay_1' }),
        createSubscription: jest.fn().mockResolvedValue({ subscriptionId: 'asaas_sub_1' }),
      },
      emitter: { emit: jest.fn() },
      ...overrides,
    };
  }

  function makeUseCase(deps: ReturnType<typeof makeDeps>) {
    return new ActivateClubSubscriptionUseCase(
      deps.tierRepo as never, deps.clubSubRepo as never, deps.stampCardRepo as never,
      deps.catalogRepo as never, deps.paymentGateway as never, deps.emitter as never,
    );
  }

  const input = { tenantId: 't1', clientId: 'client-1', tier: 'ESSENCIAL' as const, cpfCnpj: '12345678900', name: 'Fulano' };

  it('throws SubscriptionTierNotFoundError if the tier is not configured', async () => {
    const deps = makeDeps({ tierRepo: { findByTenantIdAndTier: jest.fn().mockResolvedValue(null) } });
    await expect(makeUseCase(deps).execute(input)).rejects.toThrow(SubscriptionTierNotFoundError);
  });

  it('throws ClubSubscriptionAlreadyActiveError if already ACTIVE', async () => {
    const deps = makeDeps({ clubSubRepo: { findByClientId: jest.fn().mockResolvedValue({ status: 'ACTIVE' }), save: jest.fn() } });
    await expect(makeUseCase(deps).execute(input)).rejects.toThrow(ClubSubscriptionAlreadyActiveError);
  });

  it('throws ClubSubscriptionBlockedByStampCardError if client has stamp card progress', async () => {
    const deps = makeDeps({ stampCardRepo: { findByClientId: jest.fn().mockResolvedValue({ currentStamps: 2, creditBalanceInCents: 0 }) } });
    await expect(makeUseCase(deps).execute(input)).rejects.toThrow(ClubSubscriptionBlockedByStampCardError);
  });

  it('creates Asaas customer + one-off pro-rata charge + subscription, then saves and emits', async () => {
    const deps = makeDeps();
    const useCase = makeUseCase(deps);
    await useCase.execute(input);

    expect(deps.paymentGateway.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Fulano', cpfCnpj: '12345678900' }),
    );
    expect(deps.paymentGateway.createOneOffCharge).toHaveBeenCalledWith(
      expect.objectContaining({ billingType: 'UNDEFINED' }),
    );
    expect(deps.paymentGateway.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cus_1', billingType: 'UNDEFINED' }),
    );
    expect(deps.clubSubRepo.save).toHaveBeenCalled();
    expect(deps.emitter.emit).toHaveBeenCalledWith('loyalty.club_subscription.activated', expect.objectContaining({ tenantId: 't1', clientId: 'client-1' }));
  });

  describe('timezone handling', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('uses the São Paulo calendar date, not the server/CI-runner local date, for dueDate and currentCycleStart near midnight UTC rollover', async () => {
      // 23:30 in São Paulo (UTC-3) is already 2026-07-16 in UTC — this instant must
      // still resolve to 2026-07-15 regardless of which timezone the test runner
      // (or a production server defaulting to UTC) happens to be in.
      jest.useFakeTimers().setSystemTime(new Date('2026-07-15T23:30:00-03:00'));

      const deps = makeDeps();
      const useCase = makeUseCase(deps);
      await useCase.execute(input);

      expect(deps.paymentGateway.createOneOffCharge).toHaveBeenCalledWith(
        expect.objectContaining({ dueDate: '2026-07-15' }),
      );

      const savedSubscription = deps.clubSubRepo.save.mock.calls[0][0];
      expect(savedSubscription.currentCycleStart).toBe('2026-07-15');
    });
  });
});
