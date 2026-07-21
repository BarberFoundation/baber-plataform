// apps/api/src/modules/loyalty/infra/repositories/club-subscription-drizzle.repository.spec.ts
import { ClubSubscriptionDrizzleRepository } from './club-subscription-drizzle.repository';
import { ClubSubscription } from '../../domain/entities/club-subscription.entity';

function makeChain(result: unknown) {
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
  chain.delete = jest.fn(self);
  chain.then = (resolve: (v: unknown) => void) => resolve(result);
  return chain;
}

describe('ClubSubscriptionDrizzleRepository', () => {
  const subRow = {
    id: 'sub-1', tenantId: 't1', clientId: 'client-1', tierId: 'tier-1', status: 'ACTIVE',
    asaasCustomerId: 'cus_1', asaasSubscriptionId: 'asaas_sub_1',
    currentCycleStart: '2026-07-01', currentCycleEnd: '2026-07-31',
    createdAt: new Date(), updatedAt: new Date(),
  };
  const quotaRows = [{ id: 'q-1', subscriptionId: 'sub-1', serviceId: 'svc-1', quantityTotal: 2, quantityConsumed: 0 }];

  it('findByClientId returns null when no subscription row', async () => {
    const db = { select: () => makeChain([]) };
    const repo = new ClubSubscriptionDrizzleRepository(db as never);
    expect(await repo.findByClientId('t1', 'client-1')).toBeNull();
  });

  it('findByClientId joins subscription + quota rows into the entity', async () => {
    let call = 0;
    const db = {
      select: () => makeChain(call++ === 0 ? [subRow] : quotaRows),
    };
    const repo = new ClubSubscriptionDrizzleRepository(db as never);
    const result = await repo.findByClientId('t1', 'client-1');
    expect(result).toBeInstanceOf(ClubSubscription);
    expect(result!.quotas).toEqual([{ serviceId: 'svc-1', quantityTotal: 2, quantityConsumed: 0 }]);
  });

  it('save upserts the subscription row and replaces quota rows', async () => {
    const insertChain = makeChain([subRow]);
    const deleteChain = makeChain(undefined);
    const db = {
      insert: jest.fn(() => insertChain),
      delete: jest.fn(() => deleteChain),
    };
    const repo = new ClubSubscriptionDrizzleRepository(db as never);
    const entity = ClubSubscription.createNew({
      tenantId: 't1', clientId: 'client-1', tierId: 'tier-1',
      asaasCustomerId: 'cus_1', asaasSubscriptionId: 'asaas_sub_1',
      currentCycleStart: '2026-07-01', currentCycleEnd: '2026-07-31',
      quotas: [{ serviceId: 'svc-1', quantityTotal: 2, quantityConsumed: 0 }],
    });
    const result = await repo.save(entity);
    expect(db.insert).toHaveBeenCalled();
    expect(db.delete).toHaveBeenCalled();
    expect(result.id).toBe(subRow.id);
  });
});
