import { UpdateUserProfileUseCase } from './update-user-profile.use-case';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { UserNotFoundError } from '../../domain/errors/identity.errors';

const TENANT_ID = 'tenant-1';
const USER_ID = 'user-1';

function makeUser(name: string | null = null, phone: string | null = '+5511999999999'): User {
  return User.reconstitute({
    id: USER_ID,
    tenantId: TENANT_ID,
    name,
    role: 'CLIENT',
    phone,
    email: null,
    firebaseUid: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeUserRepo(user: User | null): IUserRepository {
  return {
    findByFirebaseUid: jest.fn().mockResolvedValue(null),
    findByFirebaseUidAnyTenant: jest.fn().mockResolvedValue(null),
    findByPhone: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(user),
    findStaffByTenant: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation(async (u: User) => u),
  };
}

describe('UpdateUserProfileUseCase', () => {
  it('renames the user and saves it', async () => {
    const userRepo = makeUserRepo(makeUser(null));
    const uc = new UpdateUserProfileUseCase(userRepo);

    const result = await uc.execute({ userId: USER_ID, tenantId: TENANT_ID, name: 'Gabryel' });

    expect(result.name).toBe('Gabryel');
    expect(userRepo.save).toHaveBeenCalled();
  });

  it('updates the phone and saves it', async () => {
    const userRepo = makeUserRepo(makeUser('Gabryel'));
    const uc = new UpdateUserProfileUseCase(userRepo);

    const result = await uc.execute({ userId: USER_ID, tenantId: TENANT_ID, phone: '+5511988887777' });

    expect(result.phone).toBe('+5511988887777');
    expect(userRepo.save).toHaveBeenCalled();
  });

  it('updates both name and phone together', async () => {
    const userRepo = makeUserRepo(makeUser(null));
    const uc = new UpdateUserProfileUseCase(userRepo);

    const result = await uc.execute({
      userId: USER_ID,
      tenantId: TENANT_ID,
      name: 'Gabryel',
      phone: '+5511988887777',
    });

    expect(result.name).toBe('Gabryel');
    expect(result.phone).toBe('+5511988887777');
  });

  it('throws UserNotFoundError when user does not exist', async () => {
    const uc = new UpdateUserProfileUseCase(makeUserRepo(null));

    await expect(
      uc.execute({ userId: USER_ID, tenantId: TENANT_ID, name: 'Gabryel' }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
