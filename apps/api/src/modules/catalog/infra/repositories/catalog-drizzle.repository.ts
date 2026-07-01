import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, ne } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { Service } from '../../domain/entities/service.entity';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class CatalogDrizzleRepository implements ICatalogRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
  ) {}

  async findById(id: string, tenantId: string): Promise<Service | null> {
    const rows = await this.db
      .select()
      .from(schema.services)
      .where(and(eq(schema.services.id, id), eq(schema.services.tenantId, tenantId)))
      .limit(1);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async findAll(tenantId: string, includeInactive: boolean): Promise<Service[]> {
    const where = includeInactive
      ? eq(schema.services.tenantId, tenantId)
      : and(eq(schema.services.tenantId, tenantId), eq(schema.services.isActive, true));
    const rows = await this.db.select().from(schema.services).where(where);
    return rows.map((r) => this.toEntity(r));
  }

  async existsByName(name: string, tenantId: string, excludeId?: string): Promise<boolean> {
    const where = excludeId
      ? and(eq(schema.services.name, name), eq(schema.services.tenantId, tenantId), ne(schema.services.id, excludeId))
      : and(eq(schema.services.name, name), eq(schema.services.tenantId, tenantId));
    const result = await this.db.select({ total: count() }).from(schema.services).where(where);
    return (result[0]?.total ?? 0) > 0;
  }

  async save(service: Service): Promise<Service> {
    const now = new Date();
    await this.db
      .insert(schema.services)
      .values({
        id: service.id,
        tenantId: service.tenantId,
        name: service.name,
        description: service.description,
        priceInCents: service.priceInCents,
        durationMinutes: service.durationMinutes,
        isActive: service.isActive,
        createdAt: service.createdAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.services.id,
        set: {
          name: service.name,
          description: service.description,
          priceInCents: service.priceInCents,
          durationMinutes: service.durationMinutes,
          isActive: service.isActive,
          updatedAt: now,
        },
      });
    return Service.reconstitute({
      id: service.id,
      tenantId: service.tenantId,
      name: service.name,
      description: service.description,
      priceInCents: service.priceInCents,
      durationMinutes: service.durationMinutes,
      isActive: service.isActive,
      createdAt: service.createdAt,
      updatedAt: now,
    });
  }

  private toEntity(row: typeof schema.services.$inferSelect): Service {
    return Service.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      description: row.description ?? null,
      priceInCents: row.priceInCents,
      durationMinutes: row.durationMinutes,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
