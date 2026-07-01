import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@shared/database/database.module';

// Domain symbol tokens
import { USER_REPOSITORY } from './domain/repositories/user.repository';
import { REFRESH_TOKEN_REPOSITORY } from './domain/repositories/refresh-token.repository';
import { FIREBASE_TOKEN_VALIDATOR } from './domain/services/firebase-token-validator';

// Infra
import { UserDrizzleRepository } from './infra/repositories/user-drizzle.repository';
import { RefreshTokenDrizzleRepository } from './infra/repositories/refresh-token-drizzle.repository';
import { FirebaseTokenValidatorAdapter } from './infra/firebase/firebase-token-validator.adapter';

// Use cases
import { ExchangeFirebaseTokenUseCase } from './application/use-cases/exchange-firebase-token.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';

// Controllers
import { AdminAuthController } from './http/admin-auth.controller';
import { MeController } from './http/me.controller';

// Shared
import { JwtTokenService } from '@shared/auth/jwt-token.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AdminAuthController, MeController],
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
    // Firebase validator binding
    { provide: FIREBASE_TOKEN_VALIDATOR, useClass: FirebaseTokenValidatorAdapter },
    // Use cases
    ExchangeFirebaseTokenUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
  ],
})
export class IdentityModule {}
