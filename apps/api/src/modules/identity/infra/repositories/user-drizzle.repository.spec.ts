import { UserDrizzleRepository } from './user-drizzle.repository';
import { User } from '../../domain/entities/user.entity';
import { UserAlreadyExistsError } from '../../domain/errors/identity.errors';

function makeChain(result: unknown, error?: unknown) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = jest.fn(self);
  chain.from = jest.fn(self);
  chain.where = jest.fn(self);
  chain.orderBy = jest.fn(self);
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
    id: 'u1',
    tenantId: 't1',
    name: 'João',
    role: 'ADMIN',
    phone: '+5511999999999',
    email: null,
    firebaseUid: 'fb-1',
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeUser(overrides: Partial<Record<string, unknown>> = {}): User {
  return User.reconstitute(makeRow(overrides) as never);
}

describe('UserDrizzleRepository', () => {
  describe('findByFirebaseUid', () => {
    it('returns a reconstituted User when a row is found', async () => {
      const db = { select: jest.fn(() => makeChain([makeRow()])) };
      const repo = new UserDrizzleRepository(db as never);

      const user = await repo.findByFirebaseUid('fb-1', 't1');

      expect(user?.id).toBe('u1');
      expect(user?.name).toBe('João');
      expect(user?.role).toBe('ADMIN');
    });

    it('returns null when no row is found', async () => {
      const db = { select: jest.fn(() => makeChain([])) };
      const repo = new UserDrizzleRepository(db as never);

      const user = await repo.findByFirebaseUid('missing', 't1');

      expect(user).toBeNull();
    });
  });

  describe('findStaffByTenant', () => {
    it('maps every row to a reconstituted User', async () => {
      const rows = [makeRow({ id: 'u1', role: 'ADMIN' }), makeRow({ id: 'u2', role: 'RECEPTIONIST' })];
      const db = { select: jest.fn(() => makeChain(rows)) };
      const repo = new UserDrizzleRepository(db as never);

      const users = await repo.findStaffByTenant('t1');

      expect(users).toHaveLength(2);
      expect(users.map((u) => u.id)).toEqual(['u1', 'u2']);
      expect(users.map((u) => u.role)).toEqual(['ADMIN', 'RECEPTIONIST']);
    });
  });

  describe('save', () => {
    it('returns a reconstituted User on success', async () => {
      const row = makeRow();
      const db = { insert: jest.fn(() => makeChain([row])) };
      const repo = new UserDrizzleRepository(db as never);

      const result = await repo.save(makeUser());

      expect(result.id).toBe('u1');
    });

    it('maps a unique_violation (23505) to UserAlreadyExistsError', async () => {
      const db = { insert: jest.fn(() => makeChain(undefined, { code: '23505' })) };
      const repo = new UserDrizzleRepository(db as never);

      await expect(repo.save(makeUser())).rejects.toThrow(UserAlreadyExistsError);
    });

    it('rethrows errors that are not a unique_violation', async () => {
      const dbError = new Error('connection lost');
      const db = { insert: jest.fn(() => makeChain(undefined, dbError)) };
      const repo = new UserDrizzleRepository(db as never);

      await expect(repo.save(makeUser())).rejects.toThrow('connection lost');
    });
  });
});
