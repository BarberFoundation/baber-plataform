import { RefreshTokenUseCase } from './refresh-token.use-case';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { IRefreshTokenRepository, RefreshTokenRecord } from '../../domain/repositories/refresh-token.repository';
import { JwtTokenService } from '@shared/auth/jwt-token.service';
import { TokenPairIssuer } from '../services/token-pair-issuer';
import { User } from '../../domain/entities/user.entity';
import { InvalidRefreshTokenError } from '../../domain/errors/identity.errors';
import { createHash } from 'crypto';

const TENANT_ID = 'tenant-222';
const USER_ID = 'user-333';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function sha256(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function makeRecord(overrides?: Partial<RefreshTokenRecord>): RefreshTokenRecord {
  return {
    id: 'rec-001',
    userId: USER_ID,
    tenantId: TENANT_ID,
    tokenHash: sha256('valid-token'),
    expiresAt: new Date(Date.now() + ONE_DAY_MS),
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeUser(): User {
  return User.reconstitute({
    id: USER_ID,
    tenantId: TENANT_ID,
    name: 'Test User',
    role: 'ADMIN',
    phone: null,
    email: 'test@example.com',
    firebaseUid: 'fb-uid',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeRefreshRepo(record?: RefreshTokenRecord | null): IRefreshTokenRepository {
  return {
    findByHash: jest.fn().mockResolvedValue(record ?? null),
    revokeByHash: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function makeUserRepo(user?: User | null): IUserRepository {
  return {
    findByFirebaseUid: jest.fn().mockResolvedValue(null),
    findByPhone: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(user ?? null),
    save: jest.fn().mockResolvedValue(null),
  };
}

function makeIssuer(refreshRepo: IRefreshTokenRepository): TokenPairIssuer {
  return new TokenPairIssuer(refreshRepo, new JwtTokenService('acc-secret', 'ref-secret', '15m', '30d'));
}

describe('RefreshTokenUseCase', () => {
  it('rotates tokens: revokes old, saves new, returns new pair', async () => {
    const record = makeRecord();
    const refreshRepo = makeRefreshRepo(record);
    const userRepo = makeUserRepo(makeUser());
    const uc = new RefreshTokenUseCase(refreshRepo, userRepo, makeIssuer(refreshRepo));

    const result = await uc.execute({ rawRefreshToken: 'valid-token', tenantId: TENANT_ID });

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.refreshToken).not.toBe('valid-token'); // rotated
    expect(refreshRepo.revokeByHash).toHaveBeenCalledWith(sha256('valid-token'));
    expect(refreshRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: sha256(result.refreshToken) }),
    );
  });

  it('throws InvalidRefreshTokenError when token hash not found', async () => {
    const refreshRepo = makeRefreshRepo(null);
    const uc = new RefreshTokenUseCase(refreshRepo, makeUserRepo(makeUser()), makeIssuer(refreshRepo));
    await expect(
      uc.execute({ rawRefreshToken: 'unknown-token', tenantId: TENANT_ID }),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('throws InvalidRefreshTokenError when token is revoked', async () => {
    const revokedRecord = makeRecord({ revokedAt: new Date(Date.now() - 1000) });
    const refreshRepo = makeRefreshRepo(revokedRecord);
    const uc = new RefreshTokenUseCase(refreshRepo, makeUserRepo(makeUser()), makeIssuer(refreshRepo));
    await expect(
      uc.execute({ rawRefreshToken: 'valid-token', tenantId: TENANT_ID }),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('throws InvalidRefreshTokenError when token is expired', async () => {
    const expiredRecord = makeRecord({ expiresAt: new Date(Date.now() - 1000) });
    const refreshRepo = makeRefreshRepo(expiredRecord);
    const uc = new RefreshTokenUseCase(refreshRepo, makeUserRepo(makeUser()), makeIssuer(refreshRepo));
    await expect(
      uc.execute({ rawRefreshToken: 'valid-token', tenantId: TENANT_ID }),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('throws InvalidRefreshTokenError when user no longer exists', async () => {
    const record = makeRecord();
    const refreshRepo = makeRefreshRepo(record);
    const uc = new RefreshTokenUseCase(refreshRepo, makeUserRepo(null), makeIssuer(refreshRepo));
    await expect(
      uc.execute({ rawRefreshToken: 'valid-token', tenantId: TENANT_ID }),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('throws InvalidRefreshTokenError when token belongs to different tenant', async () => {
    const record = makeRecord(); // record.tenantId = TENANT_ID
    const refreshRepo = makeRefreshRepo(record);
    const uc = new RefreshTokenUseCase(refreshRepo, makeUserRepo(makeUser()), makeIssuer(refreshRepo));
    await expect(
      uc.execute({ rawRefreshToken: 'valid-token', tenantId: 'other-tenant' }),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });
});
