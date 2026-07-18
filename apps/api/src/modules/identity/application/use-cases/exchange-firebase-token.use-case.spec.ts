import { ExchangeFirebaseTokenUseCase } from './exchange-firebase-token.use-case';
import { IFirebaseTokenValidator } from '../../domain/services/firebase-token-validator';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { IRefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import { JwtTokenService } from '@shared/auth/jwt-token.service';
import { TokenPairIssuer } from '../services/token-pair-issuer';
import { User, UserProps } from '../../domain/entities/user.entity';
import {
  InvalidFirebaseTokenError,
  AdminAccountNotFoundError,
} from '../../domain/errors/identity.errors';

const TENANT_ID = 'tenant-111';
const FIREBASE_UID = 'firebase-abc';

function makeValidator(overrides?: Partial<IFirebaseTokenValidator>): IFirebaseTokenValidator {
  return {
    validate: jest.fn().mockResolvedValue({ uid: FIREBASE_UID, email: 'a@b.com', phone: undefined, name: 'A' }),
    ...overrides,
  };
}

function makeUserRepo(existingUser?: User): IUserRepository {
  return {
    findByFirebaseUid: jest.fn().mockResolvedValue(existingUser ?? null),
    findByFirebaseUidAnyTenant: jest.fn().mockResolvedValue(existingUser ?? null),
    findByPhone: jest.fn().mockResolvedValue(null),
    findStaffByTenant: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation(async (u: User) => u),
    findById: jest.fn().mockResolvedValue(null),
  };
}

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

function makeIssuer(refreshRepo: IRefreshTokenRepository): TokenPairIssuer {
  return new TokenPairIssuer(refreshRepo, new JwtTokenService('acc-secret', 'ref-secret', '15m', '30d'));
}

function makeExistingUser(overrides?: Partial<UserProps>): User {
  return User.reconstitute({
    id: 'existing-id',
    tenantId: TENANT_ID,
    name: 'João',
    role: 'ADMIN',
    phone: null,
    email: 'a@b.com',
    firebaseUid: FIREBASE_UID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('ExchangeFirebaseTokenUseCase', () => {
  it('returns tokens for an existing ADMIN in the tenant without creating anything', async () => {
    const userRepo = makeUserRepo(makeExistingUser());
    const refreshRepo = makeRefreshRepo();
    const uc = new ExchangeFirebaseTokenUseCase(makeValidator(), userRepo, makeIssuer(refreshRepo));
    const result = await uc.execute({ idToken: 'tok', tenantId: TENANT_ID });
    expect(result.user.id).toBe('existing-id');
    expect(result.accessToken).toBeTruthy();
    expect(userRepo.save).not.toHaveBeenCalled();
    expect(refreshRepo.save).toHaveBeenCalled();
  });

  it('returns tokens for an existing BARBER in the tenant', async () => {
    const userRepo = makeUserRepo(makeExistingUser({ role: 'BARBER' }));
    const uc = new ExchangeFirebaseTokenUseCase(makeValidator(), userRepo, makeIssuer(makeRefreshRepo()));
    const result = await uc.execute({ idToken: 'tok', tenantId: TENANT_ID });
    expect(result.user.role).toBe('BARBER');
  });

  it('throws AdminAccountNotFoundError when the firebaseUid is unknown (never auto-creates)', async () => {
    const userRepo = makeUserRepo();
    const uc = new ExchangeFirebaseTokenUseCase(makeValidator(), userRepo, makeIssuer(makeRefreshRepo()));
    await expect(uc.execute({ idToken: 'tok', tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      AdminAccountNotFoundError,
    );
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('throws AdminAccountNotFoundError when the user is a CLIENT', async () => {
    const userRepo = makeUserRepo(makeExistingUser({ role: 'CLIENT' }));
    const uc = new ExchangeFirebaseTokenUseCase(makeValidator(), userRepo, makeIssuer(makeRefreshRepo()));
    await expect(uc.execute({ idToken: 'tok', tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      AdminAccountNotFoundError,
    );
  });

  it('throws AdminAccountNotFoundError when the user belongs to another tenant (no enumeration)', async () => {
    const userRepo = makeUserRepo(makeExistingUser({ tenantId: 'tenant-999' }));
    const uc = new ExchangeFirebaseTokenUseCase(makeValidator(), userRepo, makeIssuer(makeRefreshRepo()));
    await expect(uc.execute({ idToken: 'tok', tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      AdminAccountNotFoundError,
    );
  });

  it('throws InvalidFirebaseTokenError when validator rejects', async () => {
    const validator = makeValidator({ validate: jest.fn().mockRejectedValue(new Error('bad token')) });
    const uc = new ExchangeFirebaseTokenUseCase(validator, makeUserRepo(), makeIssuer(makeRefreshRepo()));
    await expect(uc.execute({ idToken: 'bad', tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      InvalidFirebaseTokenError,
    );
  });

  it('claims a legacy invited user by phone on first login', async () => {
    const legacy = User.createInvited({ tenantId: TENANT_ID, name: 'Recepção', phone: '+5511988887777', role: 'RECEPTIONIST' });
    const userRepo = makeUserRepo();
    (userRepo.findByPhone as jest.Mock).mockResolvedValue(legacy);
    const validator = makeValidator({
      validate: jest.fn().mockResolvedValue({ uid: FIREBASE_UID, email: undefined, phone: '+5511988887777', name: 'Recepção' }),
    });
    const uc = new ExchangeFirebaseTokenUseCase(validator, userRepo, makeIssuer(makeRefreshRepo()));

    const result = await uc.execute({ idToken: 'tok', tenantId: TENANT_ID });

    expect(result.user.role).toBe('RECEPTIONIST');
    expect(userRepo.save).toHaveBeenCalledTimes(1);
    const saved = (userRepo.save as jest.Mock).mock.calls[0][0] as User;
    expect(saved.firebaseUid).toBe(FIREBASE_UID);
  });

  it('does not claim a phone match that already has a firebaseUid (falls through to not found)', async () => {
    const alreadyLinked = makeExistingUser({ firebaseUid: 'some-other-uid' });
    const userRepo = makeUserRepo();
    (userRepo.findByPhone as jest.Mock).mockResolvedValue(alreadyLinked);
    const validator = makeValidator({
      validate: jest.fn().mockResolvedValue({ uid: FIREBASE_UID, email: undefined, phone: '+5511988887777', name: 'X' }),
    });
    const uc = new ExchangeFirebaseTokenUseCase(validator, userRepo, makeIssuer(makeRefreshRepo()));

    await expect(uc.execute({ idToken: 'tok', tenantId: TENANT_ID })).rejects.toBeInstanceOf(AdminAccountNotFoundError);
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('does not claim a CLIENT-role phone match', async () => {
    const legacyClientNoFirebase = User.reconstitute({
      id: 'legacy-client', tenantId: TENANT_ID, name: null, role: 'CLIENT', phone: '+5511988887777',
      email: null, firebaseUid: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const userRepo = makeUserRepo();
    (userRepo.findByPhone as jest.Mock).mockResolvedValue(legacyClientNoFirebase);
    const validator = makeValidator({
      validate: jest.fn().mockResolvedValue({ uid: FIREBASE_UID, email: undefined, phone: '+5511988887777', name: 'X' }),
    });
    const uc = new ExchangeFirebaseTokenUseCase(validator, userRepo, makeIssuer(makeRefreshRepo()));

    await expect(uc.execute({ idToken: 'tok', tenantId: TENANT_ID })).rejects.toBeInstanceOf(AdminAccountNotFoundError);
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('throws AdminAccountNotFoundError when the user is deactivated', async () => {
    const inactiveAdmin = makeExistingUser({ isActive: false });
    const userRepo = makeUserRepo(inactiveAdmin);
    const uc = new ExchangeFirebaseTokenUseCase(makeValidator(), userRepo, makeIssuer(makeRefreshRepo()));

    await expect(uc.execute({ idToken: 'tok', tenantId: TENANT_ID })).rejects.toBeInstanceOf(AdminAccountNotFoundError);
  });
});
