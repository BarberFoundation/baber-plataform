import { randomBytes, randomUUID } from 'crypto';
import { Injectable, Inject } from '@nestjs/common';
import {
  REFRESH_TOKEN_REPOSITORY,
  IRefreshTokenRepository,
} from '../../domain/repositories/refresh-token.repository';
import { JwtTokenService } from '@shared/auth/jwt-token.service';
import { hashToken } from '@shared/auth/hash-token';
import { User } from '../../domain/entities/user.entity';
import { AuthResult } from '../dto/auth-token-pair';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class TokenPairIssuer {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: IRefreshTokenRepository,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async issue(user: User): Promise<AuthResult> {
    const jwtPayload = { userId: user.id, tenantId: user.tenantId, role: user.role };
    const accessToken = this.jwtTokenService.signAccess(jwtPayload);
    const rawRefresh = randomBytes(48).toString('base64url');
    const tokenHash = hashToken(rawRefresh);

    await this.refreshRepo.save({
      id: randomUUID(),
      userId: user.id,
      tenantId: user.tenantId,
      tokenHash,
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
        phone: user.phone,
      },
    };
  }
}
