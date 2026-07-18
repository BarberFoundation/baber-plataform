import { Injectable, Inject } from '@nestjs/common';
import {
  REFRESH_TOKEN_REPOSITORY,
  IRefreshTokenRepository,
} from '../../domain/repositories/refresh-token.repository';

export interface ListActiveSessionsInput {
  userId: string;
  currentTokenHash: string | null;
}

export interface SessionSummary {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
}

@Injectable()
export class ListActiveSessionsUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: IRefreshTokenRepository,
  ) {}

  async execute(input: ListActiveSessionsInput): Promise<SessionSummary[]> {
    const sessions = await this.refreshRepo.findActiveByUserId(input.userId);
    return sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: input.currentTokenHash !== null && s.tokenHash === input.currentTokenHash,
    }));
  }
}
