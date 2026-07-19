import { StampCardDrizzleRepository } from './stamp-card-drizzle.repository';
import { StampCard } from '../../domain/entities/stamp-card.entity';

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
  chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
    error ? reject(error) : resolve(result);
  return chain;
}

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'card-1',
    tenantId: 't1',
    clientId: 'client-1',
    currentStamps: 3,
    creditBalanceInCents: 5000,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('StampCardDrizzleRepository', () => {
  describe('findByClientId', () => {
    it('returns a reconstituted StampCard when a row is found', async () => {
      const db = { select: jest.fn(() => makeChain([makeRow()])) };
      const repo = new StampCardDrizzleRepository(db as never);

      const card = await repo.findByClientId('t1', 'client-1');

      expect(card?.clientId).toBe('client-1');
      expect(card?.currentStamps).toBe(3);
      expect(card?.creditBalanceInCents).toBe(5000);
    });

    it('returns null when no row is found', async () => {
      const db = { select: jest.fn(() => makeChain([])) };
      const repo = new StampCardDrizzleRepository(db as never);

      const card = await repo.findByClientId('t1', 'missing');

      expect(card).toBeNull();
    });
  });

  describe('save', () => {
    it('returns a reconstituted entity from the actual DB row, not the input card', async () => {
      // Mock row has a different id than the input card, proving we return DB
      // truth from .returning() rather than echoing back the input unchanged.
      // This matters because the conflict target is (tenantId, clientId), not
      // the id column, so onConflictDoUpdate can silently update a pre-existing
      // row that has a different id than the freshly generated one on `card`.
      const dbRow = makeRow({ id: 'card-db-actual-id', currentStamps: 7 });
      const db = { insert: jest.fn(() => makeChain([dbRow])) };
      const repo = new StampCardDrizzleRepository(db as never);
      const card = StampCard.createNew('t1', 'client-1');

      const result = await repo.save(card);

      expect(result.id).toBe('card-db-actual-id');
      expect(result.id).not.toBe(card.id);
      expect(result.clientId).toBe('client-1');
      expect(result.currentStamps).toBe(7);
      expect(db.insert).toHaveBeenCalled();
    });
  });
});
