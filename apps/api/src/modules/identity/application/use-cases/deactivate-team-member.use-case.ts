import { Injectable, Inject } from '@nestjs/common';
import { USER_REPOSITORY, IUserRepository } from '../../domain/repositories/user.repository';
import {
  UserNotFoundError,
  CannotDeactivateSelfError,
  LastActiveAdminError,
} from '../../domain/errors/identity.errors';

export interface DeactivateTeamMemberInput {
  tenantId: string;
  targetId: string;
  requestedByUserId: string;
}

@Injectable()
export class DeactivateTeamMemberUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository) {}

  async execute(input: DeactivateTeamMemberInput): Promise<void> {
    if (input.targetId === input.requestedByUserId) {
      throw new CannotDeactivateSelfError();
    }

    const staff = await this.userRepo.findStaffByTenant(input.tenantId);
    const target = staff.find((u) => u.id === input.targetId);
    if (!target) throw new UserNotFoundError();

    if (target.role === 'ADMIN' && target.isActive) {
      const activeAdmins = staff.filter((u) => u.role === 'ADMIN' && u.isActive);
      if (activeAdmins.length <= 1) {
        throw new LastActiveAdminError();
      }
    }

    target.deactivate();
    await this.userRepo.save(target);
  }
}
