import { Injectable, Inject } from '@nestjs/common';
import {
  REFRESH_TOKEN_REPOSITORY,
  IRefreshTokenRepository,
} from '../../domain/repositories/refresh-token.repository';
import { SessionNotFoundError, CannotRevokeCurrentSessionError } from '../../domain/errors/identity.errors';

export interface RevokeSessionInput {
  userId: string;
  sessionId: string;
  currentTokenHash: string | null;
}

@Injectable()
export class RevokeSessionUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: IRefreshTokenRepository,
  ) {}

  async execute(input: RevokeSessionInput): Promise<void> {
    const sessions = await this.refreshRepo.findActiveByUserId(input.userId);
    const target = sessions.find((s) => s.id === input.sessionId);
    if (!target) throw new SessionNotFoundError();

    if (input.currentTokenHash !== null && target.tokenHash === input.currentTokenHash) {
      throw new CannotRevokeCurrentSessionError();
    }

    const affected = await this.refreshRepo.revokeById(input.sessionId, input.userId);
    if (affected === 0) throw new SessionNotFoundError();
  }
}
