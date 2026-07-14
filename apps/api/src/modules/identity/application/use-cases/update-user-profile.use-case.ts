import { Injectable, Inject } from '@nestjs/common';
import {
  USER_REPOSITORY,
  IUserRepository,
} from '../../domain/repositories/user.repository';
import { UserNotFoundError } from '../../domain/errors/identity.errors';

export interface UpdateUserProfileInput {
  userId: string;
  tenantId: string;
  name?: string;
  phone?: string;
}

export interface UpdateUserProfileOutput {
  id: string;
  name: string | null;
  role: string;
  phone: string | null;
  email: string | null;
}

@Injectable()
export class UpdateUserProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(input: UpdateUserProfileInput): Promise<UpdateUserProfileOutput> {
    const user = await this.userRepo.findById(input.userId, input.tenantId);
    if (!user) {
      throw new UserNotFoundError();
    }

    if (input.name !== undefined) user.rename(input.name);
    if (input.phone !== undefined) user.updatePhone(input.phone);
    const saved = await this.userRepo.save(user);

    return {
      id: saved.id,
      name: saved.name,
      role: saved.role,
      phone: saved.phone,
      email: saved.email,
    };
  }
}
