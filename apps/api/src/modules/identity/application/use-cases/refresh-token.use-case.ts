import { Injectable, Inject } from '@nestjs/common';
import { hashToken } from '@shared/auth/hash-token';
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

// A refresh that succeeds server-side (old token revoked, new pair issued) can still
// be "lost" client-side — e.g. the app is killed before persisting the new pair. The
// next launch then replays the just-revoked token. Within this short window, treat
// that as the same legitimate retry rather than a stolen/reused token.
const REUSE_GRACE_MS = 30_000;

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
    const hash = hashToken(input.rawRefreshToken);

    const record = await this.refreshRepo.findByHash(hash);

    if (!record || record.expiresAt <= new Date()) {
      throw new InvalidRefreshTokenError();
    }

    const isFresh = record.revokedAt === null;
    const isWithinReuseGrace = record.revokedAt !== null && Date.now() - record.revokedAt.getTime() < REUSE_GRACE_MS;
    if (!isFresh && !isWithinReuseGrace) {
      throw new InvalidRefreshTokenError();
    }

    if (input.tenantId && record.tenantId !== input.tenantId) {
      throw new InvalidRefreshTokenError();
    }

    const user = await this.userRepo.findById(record.userId, record.tenantId);
    if (!user || !user.isActive) {
      throw new InvalidRefreshTokenError();
    }

    if (isFresh) {
      // Fail-closed: revoke first. If save throws, client loses session but no duplicate tokens exist.
      await this.refreshRepo.revokeByHash(hash);
    }

    return this.tokenPairIssuer.issue(user);
  }
}
