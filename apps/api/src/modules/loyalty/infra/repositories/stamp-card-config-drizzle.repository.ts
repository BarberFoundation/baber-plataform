import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { IStampCardConfigRepository } from '../../domain/repositories/stamp-card-config.repository';
import { StampCardConfig } from '../../domain/entities/stamp-card-config.entity';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class StampCardConfigDrizzleRepository implements IStampCardConfigRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async findByTenantId(tenantId: string): Promise<StampCardConfig | null> {
    const rows = await this.db
      .select()
      .from(schema.stampCardConfigs)
      .where(eq(schema.stampCardConfigs.tenantId, tenantId))
      .limit(1);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async upsert(config: StampCardConfig): Promise<StampCardConfig> {
    const eligibleServiceIds = [...config.eligibleServiceIds];
    const [row] = await this.db
      .insert(schema.stampCardConfigs)
      .values({
        id: config.id,
        tenantId: config.tenantId,
        eligibleServiceIds,
        stampsRequired: config.stampsRequired,
        creditValueInCents: config.creditValueInCents,
        isActive: config.isActive,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      })
      .onConflictDoUpdate({
        target: schema.stampCardConfigs.tenantId,
        set: {
          eligibleServiceIds,
          stampsRequired: config.stampsRequired,
          creditValueInCents: config.creditValueInCents,
          isActive: config.isActive,
          updatedAt: config.updatedAt,
        },
      })
      .returning();
    return this.toEntity(row);
  }

  private toEntity(row: typeof schema.stampCardConfigs.$inferSelect): StampCardConfig {
    return StampCardConfig.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      eligibleServiceIds: row.eligibleServiceIds,
      stampsRequired: row.stampsRequired,
      creditValueInCents: row.creditValueInCents,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
