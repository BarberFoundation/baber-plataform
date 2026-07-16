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
import {
  InvalidFirebaseTokenError,
  AdminAccountNotFoundError,
} from '../../domain/errors/identity.errors';
import { AuthResult } from '../dto/auth-token-pair';
import { TokenPairIssuer } from '../services/token-pair-issuer';

export interface ExchangeFirebaseTokenInput {
  idToken: string;
  tenantId: string;
}

/**
 * Troca um idToken Firebase por tokens da plataforma para o painel admin.
 *
 * NUNCA cria usuário: contas de admin/barbeiro são provisionadas fora deste
 * fluxo (seed/convite). Resposta genérica para uid desconhecido, role CLIENT
 * e tenant divergente — evita enumeração de contas.
 */
@Injectable()
export class ExchangeFirebaseTokenUseCase {
  constructor(
    @Inject(FIREBASE_TOKEN_VALIDATOR)
    private readonly validator: IFirebaseTokenValidator,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    private readonly tokenPairIssuer: TokenPairIssuer,
  ) {}

  async execute(input: ExchangeFirebaseTokenInput): Promise<AuthResult> {
    const firebasePayload: FirebaseTokenPayload = await this.validator.validate(input.idToken).catch(() => {
      throw new InvalidFirebaseTokenError();
    });

    let user = await this.userRepo.findByFirebaseUidAnyTenant(firebasePayload.uid);

    if (!user && firebasePayload.phone) {
      const legacy = await this.userRepo.findByPhone(firebasePayload.phone, input.tenantId);
      if (legacy && !legacy.firebaseUid && legacy.role !== 'CLIENT') {
        legacy.linkFirebaseUid(firebasePayload.uid);
        user = await this.userRepo.save(legacy);
      }
    }

    if (!user || user.role === 'CLIENT' || user.tenantId !== input.tenantId || !user.isActive) {
      throw new AdminAccountNotFoundError();
    }

    return this.tokenPairIssuer.issue(user);
  }
}
