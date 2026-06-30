import { LogoutUseCase } from './logout.use-case';
import { IRefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import { createHash } from 'crypto';

function sha256(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function makeRefreshRepo(overrides?: Partial<IRefreshTokenRepository>): IRefreshTokenRepository {
  return {
    findByHash: jest.fn().mockResolvedValue(null),
    revokeByHash: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('LogoutUseCase', () => {
  it('revokes the token by its hash', async () => {
    const refreshRepo = makeRefreshRepo();
    const uc = new LogoutUseCase(refreshRepo);

    await uc.execute({ rawRefreshToken: 'my-token' });

    expect(refreshRepo.revokeByHash).toHaveBeenCalledWith(sha256('my-token'));
  });

  it('is idempotent: does not throw if token not found', async () => {
    const refreshRepo = makeRefreshRepo({
      revokeByHash: jest.fn().mockResolvedValue(undefined),
    });
    const uc = new LogoutUseCase(refreshRepo);

    await expect(uc.execute({ rawRefreshToken: 'nonexistent' })).resolves.toBeUndefined();
  });

  it('is idempotent: does not throw if token already revoked', async () => {
    const refreshRepo = makeRefreshRepo({
      revokeByHash: jest.fn().mockResolvedValue(undefined),
    });
    const uc = new LogoutUseCase(refreshRepo);

    await expect(uc.execute({ rawRefreshToken: 'already-revoked' })).resolves.toBeUndefined();
  });
});
