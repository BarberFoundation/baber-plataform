import { Injectable, Inject } from '@nestjs/common';
import { hashToken } from '@shared/auth/hash-token';
import {
  REFRESH_TOKEN_REPOSITORY,
  IRefreshTokenRepository,
} from '../../domain/repositories/refresh-token.repository';

export interface LogoutInput {
  rawRefreshToken: string;
}

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: IRefreshTokenRepository,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    const hash = hashToken(input.rawRefreshToken);
    await this.refreshRepo.revokeByHash(hash);
  }
}
