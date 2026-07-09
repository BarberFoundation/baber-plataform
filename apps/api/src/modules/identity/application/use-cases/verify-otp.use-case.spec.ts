import { createHash } from 'crypto';
import { VerifyOtpUseCase } from './verify-otp.use-case';
import { IOtpCodeRepository, OtpCodeRecord } from '../../domain/repositories/otp-code.repository';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { IRefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import { JwtTokenService } from '@shared/auth/jwt-token.service';
import { TokenPairIssuer } from '../services/token-pair-issuer';
import { User } from '../../domain/entities/user.entity';
import { InvalidOtpError } from '../../domain/errors/identity.errors';

const TENANT_ID = 'tenant-1';
const PHONE = '+5511999999999';
const CODE = '123456';

function sha256(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function makeOtpRecord(overrides?: Partial<OtpCodeRecord>): OtpCodeRecord {
  return {
    id: 'otp-1',
    tenantId: TENANT_ID,
    phone: PHONE,
    codeHash: sha256(CODE),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    attempts: 0,
    usedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeOtpRepo(record: OtpCodeRecord | null): IOtpCodeRepository {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findActiveByPhone: jest.fn().mockResolvedValue(record),
    incrementAttempts: jest.fn().mockResolvedValue(undefined),
    markUsed: jest.fn().mockResolvedValue(undefined),
  };
}

function makeUserRepo(existingUser?: User | null): IUserRepository {
  return {
    findByFirebaseUid: jest.fn().mockResolvedValue(null),
    findByFirebaseUidAnyTenant: jest.fn().mockResolvedValue(null),
    findByPhone: jest.fn().mockResolvedValue(existingUser ?? null),
    findById: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation(async (u: User) => u),
  };
}

function makeIssuer(): TokenPairIssuer {
  const refreshRepo: IRefreshTokenRepository = {
    save: jest.fn().mockResolvedValue(undefined),
    findByHash: jest.fn().mockResolvedValue(null),
    revokeByHash: jest.fn().mockResolvedValue(undefined),
  };
  return new TokenPairIssuer(refreshRepo, new JwtTokenService('acc-secret', 'ref-secret', '15m', '30d'));
}

describe('VerifyOtpUseCase', () => {
  it('creates a new CLIENT user and returns tokens on first login', async () => {
    const otpRepo = makeOtpRepo(makeOtpRecord());
    const userRepo = makeUserRepo(null);
    const uc = new VerifyOtpUseCase(otpRepo, userRepo, makeIssuer());

    const result = await uc.execute({ phone: PHONE, code: CODE, tenantId: TENANT_ID });

    expect(result.user.role).toBe('CLIENT');
    expect(result.user.phone).toBe(PHONE);
    expect(result.user.name).toBeNull();
    expect(userRepo.save).toHaveBeenCalled();
    expect(otpRepo.markUsed).toHaveBeenCalledWith('otp-1');
  });

  it('reuses existing CLIENT user without creating a new one', async () => {
    const existing = User.reconstitute({
      id: 'existing-client',
      tenantId: TENANT_ID,
      name: 'Gabryel',
      role: 'CLIENT',
      phone: PHONE,
      email: null,
      firebaseUid: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const otpRepo = makeOtpRepo(makeOtpRecord());
    const userRepo = makeUserRepo(existing);
    const uc = new VerifyOtpUseCase(otpRepo, userRepo, makeIssuer());

    const result = await uc.execute({ phone: PHONE, code: CODE, tenantId: TENANT_ID });

    expect(result.user.id).toBe('existing-client');
    expect(result.user.name).toBe('Gabryel');
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('throws InvalidOtpError when no active code exists', async () => {
    const uc = new VerifyOtpUseCase(makeOtpRepo(null), makeUserRepo(null), makeIssuer());

    await expect(uc.execute({ phone: PHONE, code: CODE, tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      InvalidOtpError,
    );
  });

  it('throws InvalidOtpError and increments attempts when code does not match', async () => {
    const otpRepo = makeOtpRepo(makeOtpRecord());
    const uc = new VerifyOtpUseCase(otpRepo, makeUserRepo(null), makeIssuer());

    await expect(
      uc.execute({ phone: PHONE, code: '000000', tenantId: TENANT_ID }),
    ).rejects.toBeInstanceOf(InvalidOtpError);
    expect(otpRepo.incrementAttempts).toHaveBeenCalledWith('otp-1');
  });

  it('throws InvalidOtpError when attempts already exhausted', async () => {
    const otpRepo = makeOtpRepo(makeOtpRecord({ attempts: 3 }));
    const uc = new VerifyOtpUseCase(otpRepo, makeUserRepo(null), makeIssuer());

    await expect(uc.execute({ phone: PHONE, code: CODE, tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      InvalidOtpError,
    );
  });
});
