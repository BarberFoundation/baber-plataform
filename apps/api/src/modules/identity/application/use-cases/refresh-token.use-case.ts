import { Injectable, Inject } from '@nestjs/common';
import { randomBytes, createHash, randomUUID } from 'crypto';
import {
  REFRESH_TOKEN_REPOSITORY,
  IRefreshTokenRepository,
} from '../../domain/repositories/refresh-token.repository';
import {
  USER_REPOSITORY,
  IUserRepository,
} from '../../domain/repositories/user.repository';
import { JwtTokenService } from '@shared/auth/jwt-token.service';
import { InvalidRefreshTokenError } from '../../domain/errors/identity.errors';
import { AuthResult } from '../dto/auth-token-pair';

export interface RefreshTokenInput {
  rawRefreshToken: string;
  tenantId: string;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: IRefreshTokenRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async execute(input: RefreshTokenInput): Promise<AuthResult> {
    const hash = createHash('sha256').update(input.rawRefreshToken).digest('hex');

    const record = await this.refreshRepo.findByHash(hash);

    if (!record || record.revokedAt !== null || record.expiresAt <= new Date()) {
      throw new InvalidRefreshTokenError();
    }

    const user = await this.userRepo.findById(record.userId, record.tenantId);
    if (!user) {
      throw new InvalidRefreshTokenError();
    }

    // Rotate: revoke old token
    await this.refreshRepo.revokeByHash(hash);

    // Issue new pair
    const jwtPayload = { userId: user.id, tenantId: user.tenantId, role: user.role };
    const accessToken = this.jwtTokenService.signAccess(jwtPayload);
    const rawRefresh = randomBytes(48).toString('base64url');
    const newHash = createHash('sha256').update(rawRefresh).digest('hex');

    await this.refreshRepo.save({
      id: randomUUID(),
      userId: user.id,
      tenantId: user.tenantId,
      tokenHash: newHash,
      expiresAt: new Date(Date.now() + THIRTY_DAYS_MS),
      revokedAt: null,
      createdAt: new Date(),
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      expiresIn: this.jwtTokenService.accessExpiresInSeconds,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
      },
    };
  }
}
