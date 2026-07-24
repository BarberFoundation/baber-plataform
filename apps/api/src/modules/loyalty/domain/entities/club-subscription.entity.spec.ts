// apps/api/src/modules/loyalty/domain/entities/club-subscription.entity.spec.ts
import { ClubSubscription } from './club-subscription.entity';
import { SubscriptionQuotaExhaustedError } from '../errors/loyalty.errors';

describe('ClubSubscription', () => {
  const quotas = [{ serviceId: 'svc-1', quantityTotal: 2, quantityConsumed: 0 }];

  function makeSub() {
    return ClubSubscription.createNew({
      tenantId: 't1',
      clientId: 'client-1',
      tierId: 'tier-1',
      asaasCustomerId: 'cus_abc',
      asaasSubscriptionId: 'sub_abc',
      currentCycleStart: '2026-07-01',
      currentCycleEnd: '2026-07-31',
      quotas,
    });
  }

  it('creates ACTIVE with the given quotas', () => {
    const sub = makeSub();
    expect(sub.status).toBe('ACTIVE');
    expect(sub.quotas).toEqual(quotas);
  });

  it('consumeQuota decrements remaining and errors when exhausted', () => {
    const sub = makeSub();
    sub.consumeQuota('svc-1');
    sub.consumeQuota('svc-1');
    expect(() => sub.consumeQuota('svc-1')).toThrow(SubscriptionQuotaExhaustedError);
  });

  it('consumeQuota is a no-op for a service not in the plan (not an error)', () => {
    const sub = makeSub();
    expect(() => sub.consumeQuota('svc-not-in-plan')).not.toThrow();
  });

  it('refundQuota increments consumed back down, floored at 0', () => {
    const sub = makeSub();
    sub.consumeQuota('svc-1');
    sub.refundQuota('svc-1');
    const quota = sub.quotas.find((q) => q.serviceId === 'svc-1')!;
    expect(quota.quantityConsumed).toBe(0);
    sub.refundQuota('svc-1');
    expect(sub.quotas.find((q) => q.serviceId === 'svc-1')!.quantityConsumed).toBe(0);
  });

  it('markPastDue flips status', () => {
    const sub = makeSub();
    sub.markPastDue();
    expect(sub.status).toBe('PAST_DUE');
  });

  it('cancel flips status to CANCELED', () => {
    const sub = makeSub();
    sub.cancel();
    expect(sub.status).toBe('CANCELED');
  });

  it('renew resets quotas and advances cycle + reactivates from PAST_DUE', () => {
    const sub = makeSub();
    sub.markPastDue();
    sub.consumeQuota('svc-1');
    sub.renew('2026-08-01', '2026-08-31', [{ serviceId: 'svc-1', quantityTotal: 3 }]);
    expect(sub.status).toBe('ACTIVE');
    expect(sub.currentCycleStart).toBe('2026-08-01');
    expect(sub.currentCycleEnd).toBe('2026-08-31');
    expect(sub.quotas).toEqual([{ serviceId: 'svc-1', quantityTotal: 3, quantityConsumed: 0 }]);
  });

  it('hasProcessedPayment is false for a new subscription (no payment recorded yet)', () => {
    const sub = makeSub();
    expect(sub.hasProcessedPayment('pay_1')).toBe(false);
  });

  it('recordProcessedPayment marks a payment id so hasProcessedPayment sees it as already applied', () => {
    const sub = makeSub();
    sub.recordProcessedPayment('pay_1');
    expect(sub.hasProcessedPayment('pay_1')).toBe(true);
    expect(sub.hasProcessedPayment('pay_2')).toBe(false);
  });

  it('reactivate clears the previous payment id, since a new Asaas subscription starts fresh', () => {
    const sub = makeSub();
    sub.recordProcessedPayment('pay_1');
    sub.cancel();
    sub.reactivate('tier-1', 'cus_abc', 'sub_new', '2026-09-01', '2026-09-30', [{ serviceId: 'svc-1', quantityTotal: 2 }]);
    expect(sub.hasProcessedPayment('pay_1')).toBe(false);
  });
});
