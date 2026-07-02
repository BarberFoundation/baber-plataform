import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { Sql } from 'postgres';
import Redis from 'ioredis';
import { DRIZZLE, PG_CLIENT, REDIS } from './database.tokens';
import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: PG_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Sql => {
        return postgres(config.getOrThrow<string>('DATABASE_URL'), { max: 10 });
      },
    },
    {
      provide: DRIZZLE,
      inject: [PG_CLIENT],
      useFactory: (client: Sql): Database => drizzle(client, { schema }),
    },
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const url = config.getOrThrow<string>('REDIS_URL');
        return new Redis(url, {
          maxRetriesPerRequest: null,
          ...(url.startsWith('rediss://') && { tls: {} }),
        });
      },
    },
  ],
  exports: [DRIZZLE, PG_CLIENT, REDIS],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor() {}

  async onApplicationShutdown(): Promise<void> {
    // Conexões são fechadas pelo lifecycle do Nest via os próprios clients.
  }
}
