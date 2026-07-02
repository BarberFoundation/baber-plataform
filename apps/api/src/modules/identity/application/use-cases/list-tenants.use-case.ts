import { Injectable, Inject } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';

type DB = PostgresJsDatabase<typeof schema>;

export interface TenantSummary {
  id: string;
  slug: string;
  name: string;
}

@Injectable()
export class ListTenantsUseCase {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
  ) {}

  async execute(): Promise<TenantSummary[]> {
    const rows = await this.db
      .select({ id: schema.tenants.id, slug: schema.tenants.slug, name: schema.tenants.name })
      .from(schema.tenants);
    return rows;
  }
}
