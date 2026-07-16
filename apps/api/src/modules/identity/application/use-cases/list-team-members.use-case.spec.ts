import { ListTeamMembersUseCase } from './list-team-members.use-case';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';

function makeRepo(staff: User[]): IUserRepository {
  return {
    findByFirebaseUid: jest.fn(),
    findByFirebaseUidAnyTenant: jest.fn(),
    findByPhone: jest.fn(),
    findStaffByTenant: jest.fn().mockResolvedValue(staff),
    findById: jest.fn(),
    save: jest.fn(),
  };
}

describe('ListTeamMembersUseCase', () => {
  it('forwards tenantId to the repository and returns its result', async () => {
    const admin = User.createInvited({ tenantId: 't1', name: 'A', phone: '+551', role: 'ADMIN' });
    const repo = makeRepo([admin]);
    const uc = new ListTeamMembersUseCase(repo);

    const result = await uc.execute({ tenantId: 't1' });

    expect(repo.findStaffByTenant).toHaveBeenCalledWith('t1');
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('ADMIN');
  });
});
