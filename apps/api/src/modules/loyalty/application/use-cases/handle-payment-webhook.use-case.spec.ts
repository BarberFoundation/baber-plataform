import { HandlePaymentWebhookUseCase } from './handle-payment-webhook.use-case';
import { SubscriptionTier } from '../../domain/entities/subscription-tier.entity';

describe('HandlePaymentWebhookUseCase', () => {
  function makeSub() {
    return {
      tenantId: 't1', clientId: 'client-1', tierId: 'tier-1', status: 'ACTIVE',
      currentCycleEnd: '2026-07-31',
      renew: jest.fn(), markPastDue: jest.fn(),
    };
  }
  function makeTier() {
    return SubscriptionTier.create({
      tenantId: 't1', name: 'Essencial', services: [{ serviceId: 'svc-1', quantity: 2 }],
      discountPercentage: 0, isActive: true,
    });
  }

  it('ignores unrelated events', async () => {
    const clubSubRepo = { findByAsaasSubscriptionId: jest.fn(), save: jest.fn() };
    const tierRepo = { findById: jest.fn() };
    const emitter = { emit: jest.fn() };
    const useCase = new HandlePaymentWebhookUseCase(clubSubRepo as never, tierRepo as never, emitter as never);

    await useCase.execute({ event: 'PAYMENT_CHECKOUT_VIEWED', subscriptionId: 'asaas_sub_1' });

    expect(clubSubRepo.findByAsaasSubscriptionId).not.toHaveBeenCalled();
  });

  it('does nothing if the payment is not tied to a subscription (no subscriptionId)', async () => {
    const clubSubRepo = { findByAsaasSubscriptionId: jest.fn(), save: jest.fn() };
    const tierRepo = { findById: jest.fn() };
    const emitter = { emit: jest.fn() };
    const useCase = new HandlePaymentWebhookUseCase(clubSubRepo as never, tierRepo as never, emitter as never);

    await useCase.execute({ event: 'PAYMENT_RECEIVED', subscriptionId: null });

    expect(clubSubRepo.findByAsaasSubscriptionId).not.toHaveBeenCalled();
  });

  it('PAYMENT_RECEIVED renews the cycle, resets quotas, saves, and emits RENEWED', async () => {
    const sub = makeSub();
    const clubSubRepo = { findByAsaasSubscriptionId: jest.fn().mockResolvedValue(sub), save: jest.fn((s) => s) };
    const tierRepo = { findById: jest.fn().mockResolvedValue(makeTier()) };
    const emitter = { emit: jest.fn() };
    const useCase = new HandlePaymentWebhookUseCase(clubSubRepo as never, tierRepo as never, emitter as never);

    await useCase.execute({ event: 'PAYMENT_RECEIVED', subscriptionId: 'asaas_sub_1' });

    expect(sub.renew).toHaveBeenCalledWith(
      '2026-08-01',
      '2026-08-31',
      [{ serviceId: 'svc-1', quantityTotal: 2 }],
    );
    expect(clubSubRepo.save).toHaveBeenCalledWith(sub);
    expect(emitter.emit).toHaveBeenCalledWith('loyalty.club_subscription.renewed', expect.objectContaining({ tenantId: 't1', clientId: 'client-1' }));
  });

  it('regression: renewing an end-of-month cycle does not collapse cycleStart/cycleEnd into the same day', async () => {
    // Found via live Asaas sandbox webhook testing: currentCycleEnd '2026-08-31'
    // renewed into cycleStart === cycleEnd === '2026-08-31' instead of '2026-09-01'/'2026-09-30',
    // because new Date('2026-08-31') is UTC midnight and mixing it with local
    // getDate()/setDate() silently rolls the day back in America/Sao_Paulo (UTC-3).
    const sub = { ...makeSub(), currentCycleEnd: '2026-08-31' };
    const clubSubRepo = { findByAsaasSubscriptionId: jest.fn().mockResolvedValue(sub), save: jest.fn((s) => s) };
    const tierRepo = { findById: jest.fn().mockResolvedValue(makeTier()) };
    const emitter = { emit: jest.fn() };
    const useCase = new HandlePaymentWebhookUseCase(clubSubRepo as never, tierRepo as never, emitter as never);

    await useCase.execute({ event: 'PAYMENT_RECEIVED', subscriptionId: 'asaas_sub_1' });

    expect(sub.renew).toHaveBeenCalledWith(
      '2026-09-01',
      '2026-09-30',
      [{ serviceId: 'svc-1', quantityTotal: 2 }],
    );
  });

  it('PAYMENT_OVERDUE marks PAST_DUE, saves, and emits PAYMENT_FAILED', async () => {
    const sub = makeSub();
    const clubSubRepo = { findByAsaasSubscriptionId: jest.fn().mockResolvedValue(sub), save: jest.fn((s) => s) };
    const tierRepo = { findById: jest.fn() };
    const emitter = { emit: jest.fn() };
    const useCase = new HandlePaymentWebhookUseCase(clubSubRepo as never, tierRepo as never, emitter as never);

    await useCase.execute({ event: 'PAYMENT_OVERDUE', subscriptionId: 'asaas_sub_1' });

    expect(sub.markPastDue).toHaveBeenCalled();
    expect(clubSubRepo.save).toHaveBeenCalledWith(sub);
    expect(emitter.emit).toHaveBeenCalledWith('loyalty.club_subscription.payment_failed', expect.objectContaining({ asaasSubscriptionId: 'asaas_sub_1' }));
  });

  it('does nothing if no club subscription is found for the Asaas subscription id', async () => {
    const clubSubRepo = { findByAsaasSubscriptionId: jest.fn().mockResolvedValue(null), save: jest.fn() };
    const tierRepo = { findById: jest.fn() };
    const emitter = { emit: jest.fn() };
    const useCase = new HandlePaymentWebhookUseCase(clubSubRepo as never, tierRepo as never, emitter as never);

    await useCase.execute({ event: 'PAYMENT_RECEIVED', subscriptionId: 'asaas_sub_unknown' });

    expect(clubSubRepo.save).not.toHaveBeenCalled();
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('does nothing on renewal if the subscription tier can no longer be found', async () => {
    const sub = makeSub();
    const clubSubRepo = { findByAsaasSubscriptionId: jest.fn().mockResolvedValue(sub), save: jest.fn() };
    const tierRepo = { findById: jest.fn().mockResolvedValue(null) };
    const emitter = { emit: jest.fn() };
    const useCase = new HandlePaymentWebhookUseCase(clubSubRepo as never, tierRepo as never, emitter as never);

    await useCase.execute({ event: 'PAYMENT_RECEIVED', subscriptionId: 'asaas_sub_1' });

    expect(sub.renew).not.toHaveBeenCalled();
    expect(clubSubRepo.save).not.toHaveBeenCalled();
    expect(emitter.emit).not.toHaveBeenCalled();
  });
});
