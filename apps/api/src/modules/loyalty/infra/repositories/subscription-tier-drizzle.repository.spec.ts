// apps/api/src/modules/loyalty/infra/repositories/subscription-tier-drizzle.repository.spec.ts
import { SubscriptionTierDrizzleRepository } from './subscription-tier-drizzle.repository';
import { SubscriptionTier } from '../../domain/entities/subscription-tier.entity';

function makeChain(result: unknown, error?: unknown) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = jest.fn(self);
  chain.from = jest.fn(self);
  chain.where = jest.fn(self);
  chain.limit = jest.fn(self);
  chain.insert = jest.fn(self);
  chain.values = jest.fn(self);
  chain.onConflictDoUpdate = jest.fn(self);
  chain.returning = jest.fn(self);
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    error ? reject?.(error) : resolve(result);
  return chain;
}

describe('SubscriptionTierDrizzleRepository', () => {
  const row = {
    id: 'tier-1', tenantId: 't1', tier: 'ESSENCIAL',
    services: [{ serviceId: 'svc-1', quantity: 2 }],
    discountPercentage: 15, isActive: true,
    createdAt: new Date(), updatedAt: new Date(),
  };

  it('findByTenantId returns entities from rows', async () => {
    const db = makeChain([row]);
    const repo = new SubscriptionTierDrizzleRepository(db as never);
    const result = await repo.findByTenantId('t1');
    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(SubscriptionTier);
    expect(result[0].tier).toBe('ESSENCIAL');
  });

  it('findByTenantIdAndTier returns null when no row', async () => {
    const db = makeChain([]);
    const repo = new SubscriptionTierDrizzleRepository(db as never);
    expect(await repo.findByTenantIdAndTier('t1', 'ESSENCIAL')).toBeNull();
  });

  it('upsert reconstructs from the returned row, not the input entity', async () => {
    const db = makeChain([{ ...row, id: 'db-assigned-id' }]);
    const repo = new SubscriptionTierDrizzleRepository(db as never);
    const input = SubscriptionTier.create({
      tenantId: 't1', tier: 'ESSENCIAL', services: [{ serviceId: 'svc-1', quantity: 2 }],
      discountPercentage: 15, isActive: true,
    });
    const result = await repo.upsert(input);
    expect(result.id).toBe('db-assigned-id');
    expect(result.id).not.toBe(input.id);
  });
});
