import { ExchangeFirebaseClientTokenUseCase } from './exchange-firebase-client-token.use-case';
import { IFirebaseTokenValidator } from '../../domain/services/firebase-token-validator';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { IRefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import { JwtTokenService } from '@shared/auth/jwt-token.service';
import { TokenPairIssuer } from '../services/token-pair-issuer';
import { User } from '../../domain/entities/user.entity';
import {
  InvalidFirebaseTokenError,
  FirebaseAccountTenantMismatchError,
  TenantNotFoundError,
} from '../../domain/errors/identity.errors';
import { ITenantLookup } from '../../domain/ports/tenant-lookup.port';

const TENANT_ID = 'tenant-111';
const FIREBASE_UID = 'firebase-client-abc';
const PHONE = '+5511999999999';

function makeValidator(overrides?: Partial<IFirebaseTokenValidator>): IFirebaseTokenValidator {
  return {
    validate: jest.fn().mockResolvedValue({ uid: FIREBASE_UID, email: undefined, phone: PHONE, name: undefined }),
    ...overrides,
  };
}

function makeUserRepo(existingUser?: User): IUserRepository {
  return {
    findByFirebaseUid: jest.fn().mockResolvedValue(existingUser ?? null),
    findByFirebaseUidAnyTenant: jest.fn().mockResolvedValue(existingUser ?? null),
    findByPhone: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation(async (u: User) => u),
    findById: jest.fn().mockResolvedValue(null),
  };
}

function makeRefreshRepo(): IRefreshTokenRepository {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findByHash: jest.fn().mockResolvedValue(null),
    revokeByHash: jest.fn().mockResolvedValue(undefined),
  };
}

function makeIssuer(refreshRepo: IRefreshTokenRepository): TokenPairIssuer {
  return new TokenPairIssuer(refreshRepo, new JwtTokenService('acc-secret', 'ref-secret', '15m', '30d'));
}

function makeTenantLookup(exists = true): ITenantLookup {
  return { existsById: jest.fn().mockResolvedValue(exists) };
}

describe('ExchangeFirebaseClientTokenUseCase', () => {
  it('creates a new CLIENT user and returns tokens when user does not exist', async () => {
    const userRepo = makeUserRepo();
    const refreshRepo = makeRefreshRepo();
    const uc = new ExchangeFirebaseClientTokenUseCase(makeValidator(), userRepo, makeIssuer(refreshRepo), makeTenantLookup());
    const result = await uc.execute({ idToken: 'tok', tenantId: TENANT_ID });
    expect(result.accessToken).toBeTruthy();
    expect(result.user.role).toBe('CLIENT');
    expect(result.user.phone).toBe(PHONE);
    expect(userRepo.save).toHaveBeenCalled();
  });

  it('returns existing user without creating a new one', async () => {
    const existing = User.reconstitute({
      id: 'existing-id',
      tenantId: TENANT_ID,
      name: null,
      role: 'CLIENT',
      phone: PHONE,
      email: null,
      firebaseUid: FIREBASE_UID,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const userRepo = makeUserRepo(existing);
    const uc = new ExchangeFirebaseClientTokenUseCase(makeValidator(), userRepo, makeIssuer(makeRefreshRepo()), makeTenantLookup());
    const result = await uc.execute({ idToken: 'tok', tenantId: TENANT_ID });
    expect(result.user.id).toBe('existing-id');
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('throws FirebaseAccountTenantMismatchError when the firebaseUid belongs to a different tenant', async () => {
    const existingElsewhere = User.reconstitute({
      id: 'existing-id',
      tenantId: 'tenant-999',
      name: null,
      role: 'CLIENT',
      phone: PHONE,
      email: null,
      firebaseUid: FIREBASE_UID,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const userRepo = makeUserRepo(existingElsewhere);
    const uc = new ExchangeFirebaseClientTokenUseCase(makeValidator(), userRepo, makeIssuer(makeRefreshRepo()), makeTenantLookup());
    await expect(uc.execute({ idToken: 'tok', tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      FirebaseAccountTenantMismatchError,
    );
  });

  it('throws InvalidFirebaseTokenError when validator rejects', async () => {
    const validator = makeValidator({ validate: jest.fn().mockRejectedValue(new Error('bad token')) });
    const uc = new ExchangeFirebaseClientTokenUseCase(validator, makeUserRepo(), makeIssuer(makeRefreshRepo()), makeTenantLookup());
    await expect(uc.execute({ idToken: 'bad', tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      InvalidFirebaseTokenError,
    );
  });

  it('throws InvalidFirebaseTokenError when the token has no phone claim', async () => {
    const validator = makeValidator({
      validate: jest.fn().mockResolvedValue({ uid: FIREBASE_UID, email: undefined, phone: undefined, name: undefined }),
    });
    const uc = new ExchangeFirebaseClientTokenUseCase(validator, makeUserRepo(), makeIssuer(makeRefreshRepo()), makeTenantLookup());
    await expect(uc.execute({ idToken: 'tok', tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      InvalidFirebaseTokenError,
    );
  });

  it('throws TenantNotFoundError when tenantId does not exist', async () => {
    const uc = new ExchangeFirebaseClientTokenUseCase(
      makeValidator(),
      makeUserRepo(),
      makeIssuer(makeRefreshRepo()),
      makeTenantLookup(false),
    );
    await expect(uc.execute({ idToken: 'tok', tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      TenantNotFoundError,
    );
  });
});
