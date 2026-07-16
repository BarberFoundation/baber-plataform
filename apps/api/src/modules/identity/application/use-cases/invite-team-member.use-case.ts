import { Injectable, Inject } from '@nestjs/common';
import {
  USER_REPOSITORY,
  IUserRepository,
} from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';

export interface InviteTeamMemberInput {
  tenantId: string;
  name: string;
  phone: string;
  role: 'ADMIN' | 'RECEPTIONIST';
}

@Injectable()
export class InviteTeamMemberUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(input: InviteTeamMemberInput): Promise<User> {
    const invited = User.createInvited({
      tenantId: input.tenantId,
      name: input.name,
      phone: input.phone,
      role: input.role,
    });
    return this.userRepo.save(invited);
  }
}
