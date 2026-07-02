import { UpdateUserNameUseCase } from './update-user-name.use-case';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { UserNotFoundError } from '../../domain/errors/identity.errors';

const TENANT_ID = 'tenant-1';
const USER_ID = 'user-1';

function makeUser(name: string | null = null): User {
  return User.reconstitute({
    id: USER_ID,
    tenantId: TENANT_ID,
    name,
    role: 'CLIENT',
    phone: '+5511999999999',
    email: null,
    firebaseUid: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeUserRepo(user: User | null): IUserRepository {
  return {
    findByFirebaseUid: jest.fn().mockResolvedValue(null),
    findByPhone: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(user),
    save: jest.fn().mockImplementation(async (u: User) => u),
  };
}

describe('UpdateUserNameUseCase', () => {
  it('renames the user and saves it', async () => {
    const userRepo = makeUserRepo(makeUser(null));
    const uc = new UpdateUserNameUseCase(userRepo);

    const result = await uc.execute({ userId: USER_ID, tenantId: TENANT_ID, name: 'Gabryel' });

    expect(result.name).toBe('Gabryel');
    expect(userRepo.save).toHaveBeenCalled();
  });

  it('throws UserNotFoundError when user does not exist', async () => {
    const uc = new UpdateUserNameUseCase(makeUserRepo(null));

    await expect(
      uc.execute({ userId: USER_ID, tenantId: TENANT_ID, name: 'Gabryel' }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
