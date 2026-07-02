import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { TenantSummary } from './list-tenants.use-case';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class FindTenantBySlugUseCase {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
  ) {}

  async execute(slug: string): Promise<TenantSummary | null> {
    const rows = await this.db
      .select({ id: schema.tenants.id, slug: schema.tenants.slug, name: schema.tenants.name })
      .from(schema.tenants)
      .where(eq(schema.tenants.slug, slug))
      .limit(1);
    return rows[0] ?? null;
  }
}
