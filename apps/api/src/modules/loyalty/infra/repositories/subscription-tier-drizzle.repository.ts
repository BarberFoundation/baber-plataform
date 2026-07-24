// apps/api/src/modules/loyalty/infra/repositories/subscription-tier-drizzle.repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { ISubscriptionTierRepository } from '../../domain/repositories/subscription-tier.repository';
import { SubscriptionTier } from '../../domain/entities/subscription-tier.entity';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class SubscriptionTierDrizzleRepository implements ISubscriptionTierRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async findByTenantId(tenantId: string): Promise<SubscriptionTier[]> {
    const rows = await this.db
      .select()
      .from(schema.subscriptionTiers)
      .where(eq(schema.subscriptionTiers.tenantId, tenantId));
    return rows.map((row) => this.toEntity(row));
  }

  async findByTenantIdAndName(tenantId: string, name: string): Promise<SubscriptionTier | null> {
    const rows = await this.db
      .select()
      .from(schema.subscriptionTiers)
      .where(and(eq(schema.subscriptionTiers.tenantId, tenantId), eq(schema.subscriptionTiers.name, name)))
      .limit(1);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async findById(id: string, tenantId: string): Promise<SubscriptionTier | null> {
    const rows = await this.db
      .select()
      .from(schema.subscriptionTiers)
      .where(and(eq(schema.subscriptionTiers.id, id), eq(schema.subscriptionTiers.tenantId, tenantId)))
      .limit(1);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async upsert(tier: SubscriptionTier): Promise<SubscriptionTier> {
    const services = tier.services;
    const [row] = await this.db
      .insert(schema.subscriptionTiers)
      .values({
        id: tier.id,
        tenantId: tier.tenantId,
        name: tier.name,
        services,
        discountPercentage: tier.discountPercentage,
        isActive: tier.isActive,
        createdAt: tier.createdAt,
        updatedAt: tier.updatedAt,
      })
      .onConflictDoUpdate({
        target: schema.subscriptionTiers.id,
        set: {
          name: tier.name,
          services,
          discountPercentage: tier.discountPercentage,
          isActive: tier.isActive,
          updatedAt: tier.updatedAt,
        },
      })
      .returning();
    return this.toEntity(row);
  }

  private toEntity(row: typeof schema.subscriptionTiers.$inferSelect): SubscriptionTier {
    return SubscriptionTier.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      services: row.services,
      discountPercentage: row.discountPercentage,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
