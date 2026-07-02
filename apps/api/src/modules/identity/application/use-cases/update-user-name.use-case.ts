import { Injectable, Inject } from '@nestjs/common';
import {
  USER_REPOSITORY,
  IUserRepository,
} from '../../domain/repositories/user.repository';
import { UserNotFoundError } from '../../domain/errors/identity.errors';

export interface UpdateUserNameInput {
  userId: string;
  tenantId: string;
  name: string;
}

export interface UpdateUserNameOutput {
  id: string;
  name: string | null;
  role: string;
  phone: string | null;
  email: string | null;
}

@Injectable()
export class UpdateUserNameUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(input: UpdateUserNameInput): Promise<UpdateUserNameOutput> {
    const user = await this.userRepo.findById(input.userId, input.tenantId);
    if (!user) {
      throw new UserNotFoundError();
    }

    user.rename(input.name);
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
