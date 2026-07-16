import { InviteTeamMemberUseCase } from './invite-team-member.use-case';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';

function makeRepo(): IUserRepository {
  return {
    findByFirebaseUid: jest.fn(),
    findByFirebaseUidAnyTenant: jest.fn(),
    findByPhone: jest.fn(),
    findStaffByTenant: jest.fn(),
    findById: jest.fn(),
    save: jest.fn().mockImplementation(async (u: User) => u),
  };
}

describe('InviteTeamMemberUseCase', () => {
  it('creates a pending RECEPTIONIST invite and saves it', async () => {
    const repo = makeRepo();
    const uc = new InviteTeamMemberUseCase(repo);

    const result = await uc.execute({
      tenantId: 'tenant-1',
      name: 'Nova Recepção',
      phone: '+5511988887777',
      role: 'RECEPTIONIST',
    });

    expect(result.role).toBe('RECEPTIONIST');
    expect(result.name).toBe('Nova Recepção');
    expect(result.phone).toBe('+5511988887777');
    expect(result.firebaseUid).toBeNull();
    expect(result.isActive).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('creates a pending ADMIN invite', async () => {
    const repo = makeRepo();
    const uc = new InviteTeamMemberUseCase(repo);

    const result = await uc.execute({
      tenantId: 'tenant-1',
      name: 'Novo Admin',
      phone: '+5511977776666',
      role: 'ADMIN',
    });

    expect(result.role).toBe('ADMIN');
  });
});
