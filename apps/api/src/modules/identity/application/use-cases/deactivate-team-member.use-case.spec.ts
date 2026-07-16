import { DeactivateTeamMemberUseCase } from './deactivate-team-member.use-case';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { UserNotFoundError } from '../../domain/errors/identity.errors';
import { CannotDeactivateSelfError, LastActiveAdminError } from '../../domain/errors/identity.errors';

function makeUser(overrides: { id: string; role: 'ADMIN' | 'RECEPTIONIST'; isActive?: boolean }): User {
  return User.reconstitute({
    id: overrides.id,
    tenantId: 't1',
    name: 'X',
    role: overrides.role,
    phone: '+551',
    email: null,
    firebaseUid: 'fb-1',
    isActive: overrides.isActive ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeRepo(staff: User[]): IUserRepository {
  return {
    findByFirebaseUid: jest.fn(),
    findByFirebaseUidAnyTenant: jest.fn(),
    findByPhone: jest.fn(),
    findStaffByTenant: jest.fn().mockResolvedValue(staff),
    findById: jest.fn(),
    save: jest.fn().mockImplementation(async (u: User) => u),
  };
}

describe('DeactivateTeamMemberUseCase', () => {
  it('deactivates a RECEPTIONIST', async () => {
    const admin = makeUser({ id: 'admin-1', role: 'ADMIN' });
    const receptionist = makeUser({ id: 'recep-1', role: 'RECEPTIONIST' });
    const repo = makeRepo([admin, receptionist]);
    const uc = new DeactivateTeamMemberUseCase(repo);

    await uc.execute({ tenantId: 't1', targetId: 'recep-1', requestedByUserId: 'admin-1' });

    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved = (repo.save as jest.Mock).mock.calls[0][0] as User;
    expect(saved.isActive).toBe(false);
  });

  it('deactivates an ADMIN when another active ADMIN remains', async () => {
    const admin1 = makeUser({ id: 'admin-1', role: 'ADMIN' });
    const admin2 = makeUser({ id: 'admin-2', role: 'ADMIN' });
    const repo = makeRepo([admin1, admin2]);
    const uc = new DeactivateTeamMemberUseCase(repo);

    await uc.execute({ tenantId: 't1', targetId: 'admin-2', requestedByUserId: 'admin-1' });

    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('throws CannotDeactivateSelfError when targeting the requester', async () => {
    const admin1 = makeUser({ id: 'admin-1', role: 'ADMIN' });
    const admin2 = makeUser({ id: 'admin-2', role: 'ADMIN' });
    const repo = makeRepo([admin1, admin2]);
    const uc = new DeactivateTeamMemberUseCase(repo);

    await expect(
      uc.execute({ tenantId: 't1', targetId: 'admin-1', requestedByUserId: 'admin-1' }),
    ).rejects.toBeInstanceOf(CannotDeactivateSelfError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('throws LastActiveAdminError when the target is the only active ADMIN', async () => {
    const admin = makeUser({ id: 'admin-1', role: 'ADMIN' });
    const receptionist = makeUser({ id: 'recep-1', role: 'RECEPTIONIST' });
    const repo = makeRepo([admin, receptionist]);
    const uc = new DeactivateTeamMemberUseCase(repo);

    await expect(
      uc.execute({ tenantId: 't1', targetId: 'admin-1', requestedByUserId: 'recep-1' }),
    ).rejects.toBeInstanceOf(LastActiveAdminError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('allows deactivating an ADMIN who is already inactive without the last-admin check blocking it', async () => {
    const activeAdmin = makeUser({ id: 'admin-1', role: 'ADMIN' });
    const alreadyInactiveAdmin = makeUser({ id: 'admin-2', role: 'ADMIN', isActive: false });
    const repo = makeRepo([activeAdmin, alreadyInactiveAdmin]);
    const uc = new DeactivateTeamMemberUseCase(repo);

    await uc.execute({ tenantId: 't1', targetId: 'admin-2', requestedByUserId: 'admin-1' });

    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('throws UserNotFoundError when target is not staff of the tenant', async () => {
    const admin = makeUser({ id: 'admin-1', role: 'ADMIN' });
    const repo = makeRepo([admin]);
    const uc = new DeactivateTeamMemberUseCase(repo);

    await expect(
      uc.execute({ tenantId: 't1', targetId: 'ghost', requestedByUserId: 'admin-1' }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
