import { Injectable, Inject } from '@nestjs/common';
import { randomBytes, createHash, randomUUID } from 'crypto';
import {
  FIREBASE_TOKEN_VALIDATOR,
  IFirebaseTokenValidator,
  FirebaseTokenPayload,
} from '../../domain/services/firebase-token-validator';
import {
  USER_REPOSITORY,
  IUserRepository,
} from '../../domain/repositories/user.repository';
import {
  REFRESH_TOKEN_REPOSITORY,
  IRefreshTokenRepository,
} from '../../domain/repositories/refresh-token.repository';
import { JwtTokenService } from '@shared/auth/jwt-token.service';
import { User } from '../../domain/entities/user.entity';
import { InvalidFirebaseTokenError } from '../../domain/errors/identity.errors';
import { AuthResult } from '../dto/auth-token-pair';

export interface ExchangeFirebaseTokenInput {
  idToken: string;
  tenantId: string;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class ExchangeFirebaseTokenUseCase {
  constructor(
    @Inject(FIREBASE_TOKEN_VALIDATOR)
    private readonly validator: IFirebaseTokenValidator,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: IRefreshTokenRepository,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async execute(input: ExchangeFirebaseTokenInput): Promise<AuthResult> {
    const firebasePayload: FirebaseTokenPayload = await this.validator.validate(input.idToken).catch(() => {
      throw new InvalidFirebaseTokenError();
    });

    let user = await this.userRepo.findByFirebaseUid(firebasePayload.uid, input.tenantId);
    if (!user) {
      const newUser = User.createAdmin({
        tenantId: input.tenantId,
        email: firebasePayload.email ?? null,
        firebaseUid: firebasePayload.uid,
        name: firebasePayload.name ?? null,
      });
      user = await this.userRepo.save(newUser);
    }

    const jwtPayload = { userId: user.id, tenantId: user.tenantId, role: user.role };
    const accessToken = this.jwtTokenService.signAccess(jwtPayload);
    const rawRefresh = randomBytes(48).toString('base64url');
    const tokenHash = createHash('sha256').update(rawRefresh).digest('hex');

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
      },
    };
  }
}
