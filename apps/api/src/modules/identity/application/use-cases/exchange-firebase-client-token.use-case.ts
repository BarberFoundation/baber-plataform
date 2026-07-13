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
  UserAlreadyExistsError,
} from '../../domain/errors/identity.errors';
import { AuthResult } from '../dto/auth-token-pair';
import { TokenPairIssuer } from '../services/token-pair-issuer';
import { TENANT_LOOKUP, ITenantLookup } from '../../domain/ports/tenant-lookup.port';

export interface ExchangeFirebaseClientTokenInput {
  idToken: string;
  tenantId: string;
}

@Injectable()
export class ExchangeFirebaseClientTokenUseCase {
  constructor(
    @Inject(FIREBASE_TOKEN_VALIDATOR)
    private readonly validator: IFirebaseTokenValidator,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    private readonly tokenPairIssuer: TokenPairIssuer,
    @Inject(TENANT_LOOKUP)
    private readonly tenantLookup: ITenantLookup,
  ) {}

  async execute(input: ExchangeFirebaseClientTokenInput): Promise<AuthResult> {
    const firebasePayload: FirebaseTokenPayload = await this.validator.validate(input.idToken).catch(() => {
      throw new InvalidFirebaseTokenError();
    });

    if (!firebasePayload.phone) {
      throw new InvalidFirebaseTokenError('Token não contém número de telefone.');
    }

    let user = await this.userRepo.findByFirebaseUidAnyTenant(firebasePayload.uid);

    if (!user && !(await this.tenantLookup.existsById(input.tenantId))) {
      throw new TenantNotFoundError();
    }
    if (user && user.tenantId !== input.tenantId) {
      throw new FirebaseAccountTenantMismatchError();
    }
    if (!user) {
      const newUser = User.createClient({
        tenantId: input.tenantId,
        phone: firebasePayload.phone,
        firebaseUid: firebasePayload.uid,
      });
      try {
        user = await this.userRepo.save(newUser);
      } catch (err) {
        if (!(err instanceof UserAlreadyExistsError)) throw err;
        // Request concorrente criou o mesmo usuário entre a leitura e o insert.
        const winner = await this.userRepo.findByFirebaseUidAnyTenant(firebasePayload.uid);
        if (!winner) throw err; // conflito veio de outro unique (tenant+phone) — propaga 409
        if (winner.tenantId !== input.tenantId) throw new FirebaseAccountTenantMismatchError();
        user = winner;
      }
    }

    return this.tokenPairIssuer.issue(user);
  }
}
