import { Injectable, Inject } from '@nestjs/common';
import {
  REFRESH_TOKEN_REPOSITORY,
  IRefreshTokenRepository,
} from '../../domain/repositories/refresh-token.repository';

export interface RevokeOtherSessionsInput {
  userId: string;
  currentTokenHash: string;
}

@Injectable()
export class RevokeOtherSessionsUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: IRefreshTokenRepository,
  ) {}

  async execute(input: RevokeOtherSessionsInput): Promise<void> {
    await this.refreshRepo.revokeAllExceptHash(input.userId, input.currentTokenHash);
  }
}
