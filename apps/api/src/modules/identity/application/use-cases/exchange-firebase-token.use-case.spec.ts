import { ExchangeFirebaseTokenUseCase } from './exchange-firebase-token.use-case';
import { IFirebaseTokenValidator } from '../../domain/services/firebase-token-validator';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { IRefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import { JwtTokenService } from '@shared/auth/jwt-token.service';
import { User } from '../../domain/entities/user.entity';
import { InvalidFirebaseTokenError } from '../../domain/errors/identity.errors';

const TENANT_ID = 'tenant-111';
const FIREBASE_UID = 'firebase-abc';

function makeValidator(overrides?: Partial<IFirebaseTokenValidator>): IFirebaseTokenValidator {
  return {
    validate: jest.fn().mockResolvedValue({ uid: FIREBASE_UID, email: 'a@b.com', name: 'A' }),
    ...overrides,
  };
}

function makeUserRepo(existingUser?: User): IUserRepository {
  return {
    findByFirebaseUid: jest.fn().mockResolvedValue(existingUser ?? null),
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

function makeJwt(): JwtTokenService {
  return new JwtTokenService('acc-secret', 'ref-secret', '15m', '30d');
}

describe('ExchangeFirebaseTokenUseCase', () => {
  it('creates new user and returns tokens when user does not exist', async () => {
    const uc = new ExchangeFirebaseTokenUseCase(
      makeValidator(),
      makeUserRepo(),
      makeRefreshRepo(),
      makeJwt(),
    );
    const result = await uc.execute({ idToken: 'tok', tenantId: TENANT_ID });
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user.role).toBe('ADMIN');
  });

  it('returns existing user without creating a new one', async () => {
    const existing = User.reconstitute({
      id: 'existing-id',
      tenantId: TENANT_ID,
      name: 'João',
      role: 'ADMIN',
      phone: null,
      email: 'a@b.com',
      firebaseUid: FIREBASE_UID,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const userRepo = makeUserRepo(existing);
    const uc = new ExchangeFirebaseTokenUseCase(
      makeValidator(),
      userRepo,
      makeRefreshRepo(),
      makeJwt(),
    );
    const result = await uc.execute({ idToken: 'tok', tenantId: TENANT_ID });
    expect(result.user.id).toBe('existing-id');
    // save not called because user already exists
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('throws InvalidFirebaseTokenError when validator rejects', async () => {
    const validator = makeValidator({
      validate: jest.fn().mockRejectedValue(new Error('bad token')),
    });
    const uc = new ExchangeFirebaseTokenUseCase(
      validator,
      makeUserRepo(),
      makeRefreshRepo(),
      makeJwt(),
    );
    await expect(uc.execute({ idToken: 'bad', tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      InvalidFirebaseTokenError,
    );
  });
});
