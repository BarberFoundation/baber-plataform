import { Injectable, Inject } from '@nestjs/common';
import {
  USER_REPOSITORY,
  IUserRepository,
} from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';

export interface ListTeamMembersInput {
  tenantId: string;
}

@Injectable()
export class ListTeamMembersUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(input: ListTeamMembersInput): Promise<User[]> {
    return this.userRepo.findStaffByTenant(input.tenantId);
  }
}
