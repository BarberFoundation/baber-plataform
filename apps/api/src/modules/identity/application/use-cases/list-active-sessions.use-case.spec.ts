import { ListActiveSessionsUseCase } from './list-active-sessions.use-case';
import { IRefreshTokenRepository, RefreshTokenRecord } from '../../domain/repositories/refresh-token.repository';

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

describe('ListActiveSessionsUseCase', () => {
  it('marks the session matching currentTokenHash as current', async () => {
    const repo = makeRefreshRepo({
      findActiveByUserId: jest.fn().mockResolvedValue([
        makeRecord({ id: 's1', tokenHash: 'hash-a' }),
        makeRecord({ id: 's2', tokenHash: 'hash-b' }),
      ]),
    });
    const uc = new ListActiveSessionsUseCase(repo);

    const result = await uc.execute({ userId: 'u1', currentTokenHash: 'hash-b' });

    expect(result).toEqual([
      { id: 's1', createdAt: expect.any(Date), expiresAt: expect.any(Date), isCurrent: false },
      { id: 's2', createdAt: expect.any(Date), expiresAt: expect.any(Date), isCurrent: true },
    ]);
    expect(repo.findActiveByUserId).toHaveBeenCalledWith('u1');
  });

  it('marks nothing as current when currentTokenHash is null', async () => {
    const repo = makeRefreshRepo({ findActiveByUserId: jest.fn().mockResolvedValue([makeRecord()]) });
    const uc = new ListActiveSessionsUseCase(repo);

    const result = await uc.execute({ userId: 'u1', currentTokenHash: null });

    expect(result[0].isCurrent).toBe(false);
  });

  it('returns empty array when user has no active sessions', async () => {
    const uc = new ListActiveSessionsUseCase(makeRefreshRepo());
    const result = await uc.execute({ userId: 'u1', currentTokenHash: null });
    expect(result).toEqual([]);
  });
});
