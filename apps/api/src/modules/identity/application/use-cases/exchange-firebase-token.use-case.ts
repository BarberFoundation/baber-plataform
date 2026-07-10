import { Injectable, Inject } from '@nestjs/common';
import {
  FIREBASE_TOKEN_VALIDATOR,
  IFirebaseTokenValidator,
  FirebaseTokenPayload,
} from '../../domain/services/firebase-token-validator';
import {
  USER_REPOSITORY,
  IUserRepository,
} from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import {
  InvalidFirebaseTokenError,
  FirebaseAccountTenantMismatchError,
  TenantNotFoundError,
} from '../../domain/errors/identity.errors';
import { AuthResult } from '../dto/auth-token-pair';
import { TokenPairIssuer } from '../services/token-pair-issuer';
import { TENANT_LOOKUP, ITenantLookup } from '../../domain/ports/tenant-lookup.port';

export interface ExchangeFirebaseTokenInput {
  idToken: string;
  tenantId: string;
}

@Injectable()
export class ExchangeFirebaseTokenUseCase {
  constructor(
    @Inject(FIREBASE_TOKEN_VALIDATOR)
    private readonly validator: IFirebaseTokenValidator,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    private readonly tokenPairIssuer: TokenPairIssuer,
    @Inject(TENANT_LOOKUP)
    private readonly tenantLookup: ITenantLookup,
  ) {}

  async execute(input: ExchangeFirebaseTokenInput): Promise<AuthResult> {
    const firebasePayload: FirebaseTokenPayload = await this.validator.validate(input.idToken).catch(() => {
      throw new InvalidFirebaseTokenError();
    });

    let user = await this.userRepo.findByFirebaseUidAnyTenant(firebasePayload.uid);

    if (!user && !(await this.tenantLookup.existsById(input.tenantId))) {
      throw new TenantNotFoundError();
    }
    if (user && user.tenantId !== input.tenantId) {
      throw new FirebaseAccountTenantMismatchError();
    }
    if (!user) {
      const newUser = User.createAdmin({
        tenantId: input.tenantId,
        email: firebasePayload.email ?? null,
        phone: firebasePayload.phone ?? null,
        firebaseUid: firebasePayload.uid,
        name: firebasePayload.name ?? null,
      });
      user = await this.userRepo.save(newUser);
    }

    return this.tokenPairIssuer.issue(user);
  }
}
