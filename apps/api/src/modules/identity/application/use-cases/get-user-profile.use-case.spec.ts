import { GetUserProfileUseCase } from './get-user-profile.use-case';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { UserNotFoundError } from '../../domain/errors/identity.errors';

describe('GetUserProfileUseCase', () => {
  it('returns id, name, role, phone, email for an existing user', async () => {
    const user = User.reconstitute({
      id: 'user-1', tenantId: 'tenant-1', name: 'João', role: 'CLIENT',
      phone: '+5511999999999', email: null, firebaseUid: null,
      createdAt: new Date(), updatedAt: new Date(),
    });
    const repo: IUserRepository = {
      findByFirebaseUid: jest.fn(),
      findByFirebaseUidAnyTenant: jest.fn(),
      findByPhone: jest.fn(),
      findById: jest.fn().mockResolvedValue(user),
      save: jest.fn(),
    };
    const uc = new GetUserProfileUseCase(repo);
    const result = await uc.execute({ userId: 'user-1', tenantId: 'tenant-1' });
    expect(result).toEqual({ id: 'user-1', name: 'João', role: 'CLIENT', phone: '+5511999999999', email: null });
  });

  it('throws UserNotFoundError when user does not exist', async () => {
    const repo: IUserRepository = {
      findByFirebaseUid: jest.fn(),
      findByFirebaseUidAnyTenant: jest.fn(),
      findByPhone: jest.fn(),
      findById: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    };
    const uc = new GetUserProfileUseCase(repo);
    await expect(uc.execute({ userId: 'user-1', tenantId: 'tenant-1' })).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
