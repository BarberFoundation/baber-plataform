import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';

import { validateEnv } from './shared/config/env.validation';
import { DatabaseModule } from './shared/database/database.module';
import { HealthModule } from './shared/health/health.module';
import { TenantContext } from './shared/tenancy/tenant-context';
import { TenantMiddleware } from './shared/tenancy/tenant.middleware';
import { JwtGuard } from './shared/auth/jwt.guard';
import { RolesGuard } from './shared/auth/roles.guard';
import { JwtTokenService } from './shared/auth/jwt-token.service';

import { IdentityModule } from './modules/identity/identity.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { TeamModule } from './modules/team/team.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        autoLogging: true,
      },
    }),
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.getOrThrow<string>('REDIS_URL');
        const url = new URL(redisUrl);
        const isTls = redisUrl.startsWith('rediss://');
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || (isTls ? 6380 : 6379)),
            username: url.username || undefined,
            password: url.password ? decodeURIComponent(url.password) : undefined,
            ...(isTls && { tls: {} }),
          },
        };
      },
    }),
    DatabaseModule,
    HealthModule,
    IdentityModule,
    CatalogModule,
    TeamModule,
    SchedulingModule,
    NotificationsModule,
  ],
  providers: [
    TenantContext,
    // Factory provider avoids union-type metadata issue (string | ConfigService emits
    // Object via emitDecoratorMetadata, which NestJS cannot resolve from DI).
    {
      provide: JwtTokenService,
      useFactory: (config: ConfigService) => new JwtTokenService(config),
      inject: [ConfigService],
    },
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
