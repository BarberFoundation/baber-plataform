import { RevokeOtherSessionsUseCase } from './revoke-other-sessions.use-case';
import { IRefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';

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

describe('RevokeOtherSessionsUseCase', () => {
  it('delegates to the repository with userId and currentTokenHash', async () => {
    const repo = makeRefreshRepo();
    const uc = new RevokeOtherSessionsUseCase(repo);

    await uc.execute({ userId: 'u1', currentTokenHash: 'hash-a' });

    expect(repo.revokeAllExceptHash).toHaveBeenCalledWith('u1', 'hash-a');
  });

  it('propagates repository errors upward', async () => {
    const repo = makeRefreshRepo({
      revokeAllExceptHash: jest.fn().mockRejectedValue(new Error('DB connection lost')),
    });
    const uc = new RevokeOtherSessionsUseCase(repo);

    await expect(uc.execute({ userId: 'u1', currentTokenHash: 'hash-a' })).rejects.toThrow(
      'DB connection lost',
    );
  });
});
