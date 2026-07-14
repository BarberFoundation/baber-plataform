import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { TenantNotFoundError } from '../../domain/errors/identity.errors';

type DB = PostgresJsDatabase<typeof schema>;

export interface GetTenantSettingsInput {
  tenantId: string;
}

@Injectable()
export class GetTenantSettingsUseCase {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async execute(input: GetTenantSettingsInput): Promise<schema.Tenant> {
    const rows = await this.db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, input.tenantId))
      .limit(1);
    if (!rows[0]) throw new TenantNotFoundError();
    return rows[0];
  }
}
