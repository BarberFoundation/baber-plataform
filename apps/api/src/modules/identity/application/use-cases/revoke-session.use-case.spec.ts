import { RevokeSessionUseCase } from './revoke-session.use-case';
import { IRefreshTokenRepository, RefreshTokenRecord } from '../../domain/repositories/refresh-token.repository';
import { SessionNotFoundError, CannotRevokeCurrentSessionError } from '../../domain/errors/identity.errors';

function makeRecord(overrides?: Partial<RefreshTokenRecord>): RefreshTokenRecord {
  return {
    id: 's1',
    userId: 'u1',
    tenantId: 't1',
    tokenHash: 'hash-a',
    expiresAt: new Date('2026-08-01T00:00:00Z'),
    revokedAt: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    ...overrides,
  };
}

function makeRefreshRepo(overrides?: Partial<IRefreshTokenRepository>): IRefreshTokenRepository {
  return {
    findByHash: jest.fn().mockResolvedValue(null),
    revokeByHash: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    findActiveByUserId: jest.fn().mockResolvedValue([]),
    revokeById: jest.fn().mockResolvedValue(0),
    revokeAllExceptHash: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('RevokeSessionUseCase', () => {
  it('revokes a session that belongs to the user and is not the current one', async () => {
    const repo = makeRefreshRepo({
      findActiveByUserId: jest.fn().mockResolvedValue([makeRecord({ id: 's1', tokenHash: 'hash-a' })]),
      revokeById: jest.fn().mockResolvedValue(1),
    });
    const uc = new RevokeSessionUseCase(repo);

    await uc.execute({ userId: 'u1', sessionId: 's1', currentTokenHash: 'hash-b' });

    expect(repo.revokeById).toHaveBeenCalledWith('s1', 'u1');
  });

  it('throws SessionNotFoundError when the session id does not belong to the user', async () => {
    const repo = makeRefreshRepo({ findActiveByUserId: jest.fn().mockResolvedValue([]) });
    const uc = new RevokeSessionUseCase(repo);

    await expect(
      uc.execute({ userId: 'u1', sessionId: 'ghost', currentTokenHash: null }),
    ).rejects.toThrow(SessionNotFoundError);
  });

  it('throws CannotRevokeCurrentSessionError when trying to revoke the calling session', async () => {
    const repo = makeRefreshRepo({
      findActiveByUserId: jest.fn().mockResolvedValue([makeRecord({ id: 's1', tokenHash: 'hash-a' })]),
    });
    const uc = new RevokeSessionUseCase(repo);

    await expect(
      uc.execute({ userId: 'u1', sessionId: 's1', currentTokenHash: 'hash-a' }),
    ).rejects.toThrow(CannotRevokeCurrentSessionError);
    expect(repo.revokeById).not.toHaveBeenCalled();
  });

  it('throws SessionNotFoundError if the row was revoked concurrently between the lookup and the revoke', async () => {
    const repo = makeRefreshRepo({
      findActiveByUserId: jest.fn().mockResolvedValue([makeRecord({ id: 's1', tokenHash: 'hash-a' })]),
      revokeById: jest.fn().mockResolvedValue(0),
    });
    const uc = new RevokeSessionUseCase(repo);

    await expect(
      uc.execute({ userId: 'u1', sessionId: 's1', currentTokenHash: 'hash-b' }),
    ).rejects.toThrow(SessionNotFoundError);
  });
});
