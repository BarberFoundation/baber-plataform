import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { isUUID } from 'class-validator';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { ITenantLookup } from '../../domain/ports/tenant-lookup.port';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class TenantLookupAdapter implements ITenantLookup {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async existsById(tenantId: string): Promise<boolean> {
    if (!isUUID(tenantId, '4')) return false;
    const rows = await this.db
      .select({ id: schema.tenants.id })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId))
      .limit(1);
    return rows.length > 0;
  }
}
