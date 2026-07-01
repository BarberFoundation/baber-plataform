import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';
import { WorkSchedule, defaultWorkSchedule } from '../../domain/value-objects/work-schedule';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class TeamDrizzleRepository implements ITeamRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
  ) {}

  async findById(id: string, tenantId: string): Promise<Barber | null> {
    const rows = await this.db
      .select()
      .from(schema.barbers)
      .where(and(eq(schema.barbers.id, id), eq(schema.barbers.tenantId, tenantId)))
      .limit(1);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async findAll(tenantId: string, includeInactive: boolean): Promise<Barber[]> {
    const where = includeInactive
      ? eq(schema.barbers.tenantId, tenantId)
      : and(eq(schema.barbers.tenantId, tenantId), eq(schema.barbers.isActive, true));
    const rows = await this.db.select().from(schema.barbers).where(where);
    return rows.map((r) => this.toEntity(r));
  }

  async save(barber: Barber): Promise<Barber> {
    const updatedAt = barber.updatedAt;
    await this.db
      .insert(schema.barbers)
      .values({
        id: barber.id,
        tenantId: barber.tenantId,
        name: barber.name,
        phone: barber.phone,
        isActive: barber.isActive,
        workSchedule: barber.workSchedule,
        createdAt: barber.createdAt,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: schema.barbers.id,
        set: {
          name: barber.name,
          phone: barber.phone,
          isActive: barber.isActive,
          workSchedule: barber.workSchedule,
          updatedAt,
        },
      });

    return Barber.reconstitute({
      id: barber.id,
      tenantId: barber.tenantId,
      name: barber.name,
      phone: barber.phone,
      isActive: barber.isActive,
      workSchedule: barber.workSchedule,
      createdAt: barber.createdAt,
      updatedAt,
    });
  }

  private toEntity(row: typeof schema.barbers.$inferSelect): Barber {
    return Barber.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      phone: row.phone ?? null,
      isActive: row.isActive,
      workSchedule: (row.workSchedule as WorkSchedule) ?? defaultWorkSchedule(),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
