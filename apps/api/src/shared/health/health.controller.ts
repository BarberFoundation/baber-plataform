import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Sql } from 'postgres';
import type Redis from 'ioredis';
import { PG_CLIENT, REDIS } from '../database/database.tokens';
import { Public } from '../auth/public.decorator';

@ApiTags('health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    @Inject(PG_CLIENT) private readonly pg: Sql,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  async check() {
    const [postgres, redis] = await Promise.all([this.checkPostgres(), this.checkRedis()]);

    const ok = postgres === 'up' && redis === 'up';
    const body = {
      status: ok ? 'ok' : 'degraded',
      services: { postgres, redis },
      timestamp: new Date().toISOString(),
    };

    if (!ok) throw new ServiceUnavailableException(body);
    return body;
  }

  private async checkPostgres(): Promise<'up' | 'down'> {
    try {
      await this.pg`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<'up' | 'down'> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
