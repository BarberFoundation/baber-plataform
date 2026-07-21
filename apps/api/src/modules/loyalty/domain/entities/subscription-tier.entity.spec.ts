// apps/api/src/modules/loyalty/domain/entities/subscription-tier.entity.spec.ts
import { SubscriptionTier } from './subscription-tier.entity';
import { InvalidSubscriptionTierError } from '../errors/loyalty.errors';

describe('SubscriptionTier', () => {
  const validServices = [{ serviceId: 'svc-1', quantity: 2 }, { serviceId: 'svc-2', quantity: 1 }];

  it('creates with valid props', () => {
    const tier = SubscriptionTier.create({
      tenantId: 't1',
      tier: 'ESSENCIAL',
      services: validServices,
      discountPercentage: 15,
      isActive: true,
    });
    expect(tier.tier).toBe('ESSENCIAL');
    expect(tier.services).toEqual(validServices);
    expect(tier.discountPercentage).toBe(15);
  });

  it('rejects empty services', () => {
    expect(() => SubscriptionTier.create({
      tenantId: 't1', tier: 'ESSENCIAL', services: [], discountPercentage: 15, isActive: true,
    })).toThrow(InvalidSubscriptionTierError);
  });

  it('rejects a service with quantity < 1', () => {
    expect(() => SubscriptionTier.create({
      tenantId: 't1', tier: 'ESSENCIAL', services: [{ serviceId: 'svc-1', quantity: 0 }], discountPercentage: 15, isActive: true,
    })).toThrow(InvalidSubscriptionTierError);
  });

  it('rejects discountPercentage outside 0-100', () => {
    expect(() => SubscriptionTier.create({
      tenantId: 't1', tier: 'ESSENCIAL', services: validServices, discountPercentage: 101, isActive: true,
    })).toThrow(InvalidSubscriptionTierError);
  });

  it('calculates price from catalog with discount applied', () => {
    const tier = SubscriptionTier.create({
      tenantId: 't1', tier: 'ESSENCIAL', services: validServices, discountPercentage: 15, isActive: true,
    });
    // 2×3500 (svc-1) + 1×2000 (svc-2) = 9000; 15% off = 7650
    const catalog = new Map([['svc-1', 3500], ['svc-2', 2000]]);
    expect(tier.calculatePriceInCents(catalog)).toBe(7650);
  });

  it('throws if a combo service is missing from the catalog', () => {
    const tier = SubscriptionTier.create({
      tenantId: 't1', tier: 'ESSENCIAL', services: validServices, discountPercentage: 15, isActive: true,
    });
    expect(() => tier.calculatePriceInCents(new Map([['svc-1', 3500]]))).toThrow(InvalidSubscriptionTierError);
  });

  it('services getter returns a defensive copy', () => {
    const tier = SubscriptionTier.create({
      tenantId: 't1', tier: 'ESSENCIAL', services: validServices, discountPercentage: 15, isActive: true,
    });
    const copy = tier.services;
    copy.push({ serviceId: 'svc-3', quantity: 9 });
    expect(tier.services).toHaveLength(2);
  });
});
