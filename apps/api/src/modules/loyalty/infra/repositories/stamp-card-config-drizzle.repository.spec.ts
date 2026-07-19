import { StampCardConfigDrizzleRepository } from './stamp-card-config-drizzle.repository';
import { StampCardConfig } from '../../domain/entities/stamp-card-config.entity';

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
  chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
    error ? reject(error) : resolve(result);
  return chain;
}

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'cfg-1',
    tenantId: 't1',
    eligibleServiceIds: ['svc-1'],
    stampsRequired: 10,
    creditValueInCents: 5000,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('StampCardConfigDrizzleRepository', () => {
  describe('findByTenantId', () => {
    it('returns a reconstituted StampCardConfig when a row is found', async () => {
      const db = { select: jest.fn(() => makeChain([makeRow()])) };
      const repo = new StampCardConfigDrizzleRepository(db as never);

      const config = await repo.findByTenantId('t1');

      expect(config?.tenantId).toBe('t1');
      expect(config?.stampsRequired).toBe(10);
    });

    it('returns null when no row is found', async () => {
      const db = { select: jest.fn(() => makeChain([])) };
      const repo = new StampCardConfigDrizzleRepository(db as never);

      const config = await repo.findByTenantId('missing');

      expect(config).toBeNull();
    });
  });

  describe('upsert', () => {
    it('returns the same config it was given', async () => {
      const db = { insert: jest.fn(() => makeChain(undefined)) };
      const repo = new StampCardConfigDrizzleRepository(db as never);
      const config = StampCardConfig.create({
        tenantId: 't1',
        eligibleServiceIds: ['svc-1'],
        stampsRequired: 10,
        creditValueInCents: 5000,
        isActive: true,
      });

      const result = await repo.upsert(config);

      expect(result).toBe(config);
      expect(db.insert).toHaveBeenCalled();
    });
  });
});
