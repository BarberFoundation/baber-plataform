import { Injectable, Inject } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  REFRESH_TOKEN_REPOSITORY,
  IRefreshTokenRepository,
} from '../../domain/repositories/refresh-token.repository';
import {
  USER_REPOSITORY,
  IUserRepository,
} from '../../domain/repositories/user.repository';
import { InvalidRefreshTokenError } from '../../domain/errors/identity.errors';
import { AuthResult } from '../dto/auth-token-pair';
import { TokenPairIssuer } from '../services/token-pair-issuer';

export interface RefreshTokenInput {
  rawRefreshToken: string;
  tenantId?: string; // optional — when absent, tenant guard is skipped (HTTP refresh flow)
}

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: IRefreshTokenRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    private readonly tokenPairIssuer: TokenPairIssuer,
  ) {}

  async execute(input: RefreshTokenInput): Promise<AuthResult> {
    const hash = createHash('sha256').update(input.rawRefreshToken).digest('hex');

    const record = await this.refreshRepo.findByHash(hash);

    if (!record || record.revokedAt !== null || record.expiresAt <= new Date()) {
      throw new InvalidRefreshTokenError();
    }

    if (input.tenantId && record.tenantId !== input.tenantId) {
      throw new InvalidRefreshTokenError();
    }

    const user = await this.userRepo.findById(record.userId, record.tenantId);
    if (!user || !user.isActive) {
      throw new InvalidRefreshTokenError();
    }

    // Fail-closed: revoke first. If save throws, client loses session but no duplicate tokens exist.
    await this.refreshRepo.revokeByHash(hash);

    return this.tokenPairIssuer.issue(user);
  }
}
