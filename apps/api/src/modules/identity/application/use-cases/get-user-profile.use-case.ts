import { Injectable, Inject } from '@nestjs/common';
import { USER_REPOSITORY, IUserRepository } from '../../domain/repositories/user.repository';
import { UserNotFoundError } from '../../domain/errors/identity.errors';

export interface GetUserProfileInput {
  userId: string;
  tenantId: string;
}

export interface GetUserProfileOutput {
  id: string;
  name: string | null;
  role: string;
  phone: string | null;
  email: string | null;
}

@Injectable()
export class GetUserProfileUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository) {}

  async execute(input: GetUserProfileInput): Promise<GetUserProfileOutput> {
    const user = await this.userRepo.findById(input.userId, input.tenantId);
    if (!user) throw new UserNotFoundError();
    return { id: user.id, name: user.name, role: user.role, phone: user.phone, email: user.email };
  }
}
