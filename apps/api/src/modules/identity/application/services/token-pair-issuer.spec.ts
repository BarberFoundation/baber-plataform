import { createHash } from 'crypto';
import { TokenPairIssuer } from './token-pair-issuer';
import { IRefreshTokenRepository, RefreshTokenRecord } from '../../domain/repositories/refresh-token.repository';
import { JwtTokenService } from '@shared/auth/jwt-token.service';
import { User } from '../../domain/entities/user.entity';

const TENANT_ID = 'tenant-999';

function makeRefreshRepo(): IRefreshTokenRepository {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findByHash: jest.fn().mockResolvedValue(null),
    revokeByHash: jest.fn().mockResolvedValue(undefined),
    findActiveByUserId: jest.fn().mockResolvedValue([]),
    revokeById: jest.fn().mockResolvedValue(0),
    revokeAllExceptHash: jest.fn().mockResolvedValue(undefined),
  };
}

function makeJwt(): JwtTokenService {
  return new JwtTokenService('acc-secret', 'ref-secret', '15m', '30d');
}

function makeUser(overrides?: Partial<Parameters<typeof User.reconstitute>[0]>): User {
  return User.reconstitute({
    id: 'user-1',
    tenantId: TENANT_ID,
    name: 'Test',
    role: 'ADMIN',
    phone: null,
    email: 'a@b.com',
    firebaseUid: 'fb-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('TokenPairIssuer', () => {
  it('issues access + refresh token and saves the hashed refresh token', async () => {
    const refreshRepo = makeRefreshRepo();
    const issuer = new TokenPairIssuer(refreshRepo, makeJwt());

    const result = await issuer.issue(makeUser());

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.expiresIn).toBe(900);
    expect(result.user).toEqual({
      id: 'user-1',
      name: 'Test',
      role: 'ADMIN',
      email: 'a@b.com',
      phone: null,
    });
    const savedRecord = (refreshRepo.save as jest.Mock).mock.calls[0][0] as RefreshTokenRecord;
    expect(savedRecord.tokenHash).toBe(createHash('sha256').update(result.refreshToken).digest('hex'));
    expect(savedRecord.userId).toBe('user-1');
    expect(savedRecord.tenantId).toBe(TENANT_ID);
  });

  it('includes phone for CLIENT users', async () => {
    const issuer = new TokenPairIssuer(makeRefreshRepo(), makeJwt());

    const result = await issuer.issue(
      makeUser({ role: 'CLIENT', phone: '+5511999999999', email: null, firebaseUid: null, name: null }),
    );

    expect(result.user.phone).toBe('+5511999999999');
  });
});
