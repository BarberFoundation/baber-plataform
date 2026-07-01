import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { IBarberLookup, BarberLookupResult } from '../../domain/ports/barber-lookup.port';
import { WorkSchedule } from '../../../team/domain/value-objects/work-schedule';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class BarberLookupAdapter implements IBarberLookup {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async findById(id: string, tenantId: string): Promise<BarberLookupResult | null> {
    const rows = await this.db
      .select({ isActive: schema.barbers.isActive, workSchedule: schema.barbers.workSchedule })
      .from(schema.barbers)
      .where(and(eq(schema.barbers.id, id), eq(schema.barbers.tenantId, tenantId)))
      .limit(1);
    if (!rows[0]) return null;
    return {
      isActive:     rows[0].isActive,
      workSchedule: rows[0].workSchedule as WorkSchedule,
    };
  }
}
