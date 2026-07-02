import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@shared/database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';

// Domain symbol tokens
import { USER_REPOSITORY } from './domain/repositories/user.repository';
import { REFRESH_TOKEN_REPOSITORY } from './domain/repositories/refresh-token.repository';
import { OTP_CODE_REPOSITORY } from './domain/repositories/otp-code.repository';
import { FIREBASE_TOKEN_VALIDATOR } from './domain/services/firebase-token-validator';

// Infra
import { UserDrizzleRepository } from './infra/repositories/user-drizzle.repository';
import { RefreshTokenDrizzleRepository } from './infra/repositories/refresh-token-drizzle.repository';
import { OtpCodeDrizzleRepository } from './infra/repositories/otp-code-drizzle.repository';
import { FirebaseTokenValidatorAdapter } from './infra/firebase/firebase-token-validator.adapter';

// Application services
import { TokenPairIssuer } from './application/services/token-pair-issuer';

// Use cases
import { ExchangeFirebaseTokenUseCase } from './application/use-cases/exchange-firebase-token.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { RequestOtpUseCase } from './application/use-cases/request-otp.use-case';
import { VerifyOtpUseCase } from './application/use-cases/verify-otp.use-case';
import { UpdateUserNameUseCase } from './application/use-cases/update-user-name.use-case';
import { ListTenantsUseCase } from './application/use-cases/list-tenants.use-case';
import { FindTenantBySlugUseCase } from './application/use-cases/find-tenant-by-slug.use-case';

// Controllers
import { AdminAuthController } from './http/admin-auth.controller';
import { AuthController } from './http/auth.controller';
import { MeController } from './http/me.controller';
import { OtpAuthController } from './http/otp-auth.controller';
import { TenantsController } from './http/tenants.controller';

// Shared
import { JwtTokenService } from '@shared/auth/jwt-token.service';

@Module({
  imports: [DatabaseModule, NotificationsModule],
  controllers: [
    AdminAuthController,
    AuthController,
    MeController,
    OtpAuthController,
    TenantsController,
  ],
  providers: [
    // JwtTokenService — provided here via factory because AppModule does not export it.
    // ConfigModule is global so ConfigService is available in every module's DI context.
    {
      provide: JwtTokenService,
      useFactory: (config: ConfigService) => new JwtTokenService(config),
      inject: [ConfigService],
    },
    // Repository bindings
    { provide: USER_REPOSITORY, useClass: UserDrizzleRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: RefreshTokenDrizzleRepository },
    { provide: OTP_CODE_REPOSITORY, useClass: OtpCodeDrizzleRepository },
    // Firebase validator binding
    { provide: FIREBASE_TOKEN_VALIDATOR, useClass: FirebaseTokenValidatorAdapter },
    // Application services
    TokenPairIssuer,
    // Use cases
    ExchangeFirebaseTokenUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    RequestOtpUseCase,
    VerifyOtpUseCase,
    UpdateUserNameUseCase,
    ListTenantsUseCase,
    FindTenantBySlugUseCase,
  ],
})
export class IdentityModule {}
