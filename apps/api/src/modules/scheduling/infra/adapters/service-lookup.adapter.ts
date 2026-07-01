import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { IServiceLookup, ServiceLookupResult } from '../../domain/ports/service-lookup.port';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class ServiceLookupAdapter implements IServiceLookup {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async findById(id: string, tenantId: string): Promise<ServiceLookupResult | null> {
    const rows = await this.db
      .select({ durationMinutes: schema.services.durationMinutes, isActive: schema.services.isActive })
      .from(schema.services)
      .where(and(eq(schema.services.id, id), eq(schema.services.tenantId, tenantId)))
      .limit(1);
    if (!rows[0]) return null;
    return {
      durationMinutes: rows[0].durationMinutes,
      isActive:        rows[0].isActive,
    };
  }
}
