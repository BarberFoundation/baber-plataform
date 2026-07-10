import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@shared/database/database.module';

// Domain symbol tokens
import { USER_REPOSITORY } from './domain/repositories/user.repository';
import { REFRESH_TOKEN_REPOSITORY } from './domain/repositories/refresh-token.repository';
import { FIREBASE_TOKEN_VALIDATOR } from './domain/services/firebase-token-validator';
import { TENANT_LOOKUP } from './domain/ports/tenant-lookup.port';

// Infra
import { UserDrizzleRepository } from './infra/repositories/user-drizzle.repository';
import { RefreshTokenDrizzleRepository } from './infra/repositories/refresh-token-drizzle.repository';
import { FirebaseTokenValidatorAdapter } from './infra/firebase/firebase-token-validator.adapter';
import { TenantLookupAdapter } from './infra/adapters/tenant-lookup.adapter';

// Application services
import { TokenPairIssuer } from './application/services/token-pair-issuer';

// Use cases
import { ExchangeFirebaseTokenUseCase } from './application/use-cases/exchange-firebase-token.use-case';
import { ExchangeFirebaseClientTokenUseCase } from './application/use-cases/exchange-firebase-client-token.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { UpdateUserNameUseCase } from './application/use-cases/update-user-name.use-case';
import { GetUserProfileUseCase } from './application/use-cases/get-user-profile.use-case';
import { ListTenantsUseCase } from './application/use-cases/list-tenants.use-case';
import { FindTenantBySlugUseCase } from './application/use-cases/find-tenant-by-slug.use-case';

// Controllers
import { AdminAuthController } from './http/admin-auth.controller';
import { ClientAuthController } from './http/client-auth.controller';
import { AuthController } from './http/auth.controller';
import { MeController } from './http/me.controller';
import { TenantsController } from './http/tenants.controller';

// Shared
import { JwtTokenService } from '@shared/auth/jwt-token.service';

@Module({
  imports: [DatabaseModule],
  controllers: [
    AdminAuthController,
    ClientAuthController,
    AuthController,
    MeController,
    TenantsController,
  ],
  providers: [
    {
      provide: JwtTokenService,
      useFactory: (config: ConfigService) => new JwtTokenService(config),
      inject: [ConfigService],
    },
    { provide: USER_REPOSITORY, useClass: UserDrizzleRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: RefreshTokenDrizzleRepository },
    { provide: FIREBASE_TOKEN_VALIDATOR, useClass: FirebaseTokenValidatorAdapter },
    { provide: TENANT_LOOKUP, useClass: TenantLookupAdapter },
    TokenPairIssuer,
    ExchangeFirebaseTokenUseCase,
    ExchangeFirebaseClientTokenUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    UpdateUserNameUseCase,
    GetUserProfileUseCase,
    ListTenantsUseCase,
    FindTenantBySlugUseCase,
  ],
})
export class IdentityModule {}
