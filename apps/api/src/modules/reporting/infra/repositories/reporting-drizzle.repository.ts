import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, gte, isNotNull, lt, lte, ne, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { WorkSchedule } from '../../../team/domain/value-objects/work-schedule';
import {
  IReportingRepository,
  RevenueAggregates,
  HeatmapCell,
  ActiveBarberSchedule,
  NewReturningCounts,
  InactiveClient,
} from '../../application/ports/reporting.repository';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class ReportingDrizzleRepository implements IReportingRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  private completedInRange(tenantId: string, from: string, to: string) {
    return and(
      eq(schema.appointments.tenantId, tenantId),
      eq(schema.appointments.status, 'COMPLETED'),
      gte(schema.appointments.date, from),
      lte(schema.appointments.date, to),
    );
  }

  private notCancelledInRange(tenantId: string, from: string, to: string) {
    return and(
      eq(schema.appointments.tenantId, tenantId),
      ne(schema.appointments.status, 'CANCELLED'),
      gte(schema.appointments.date, from),
      lte(schema.appointments.date, to),
    );
  }

  async revenueAggregates(tenantId: string, from: string, to: string): Promise<RevenueAggregates> {
    const where = this.completedInRange(tenantId, from, to);

    const [totals] = await this.db
      .select({
        totalInCents: sql<number>`coalesce(sum(${schema.appointments.priceInCents}), 0)::int`,
        appointmentCount: count(),
      })
      .from(schema.appointments)
      .where(where);

    const byDay = await this.db
      .select({
        date: schema.appointments.date,
        totalInCents: sql<number>`sum(${schema.appointments.priceInCents})::int`,
        count: count(),
      })
      .from(schema.appointments)
      .where(where)
      .groupBy(schema.appointments.date)
      .orderBy(schema.appointments.date);

    const byService = await this.db
      .select({
        serviceId: schema.appointments.serviceId,
        serviceName: schema.services.name,
        totalInCents: sql<number>`sum(${schema.appointments.priceInCents})::int`,
        count: count(),
      })
      .from(schema.appointments)
      .innerJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
      .where(where)
      .groupBy(schema.appointments.serviceId, schema.services.name)
      .orderBy(sql`sum(${schema.appointments.priceInCents}) desc`);

    const byBarber = await this.db
      .select({
        barberId: schema.appointments.barberId,
        barberName: schema.barbers.name,
        totalInCents: sql<number>`sum(${schema.appointments.priceInCents})::int`,
        count: count(),
      })
      .from(schema.appointments)
      .innerJoin(schema.barbers, eq(schema.appointments.barberId, schema.barbers.id))
      .where(where)
      .groupBy(schema.appointments.barberId, schema.barbers.name)
      .orderBy(sql`sum(${schema.appointments.priceInCents}) desc`);

    return {
      totalInCents: totals?.totalInCents ?? 0,
      appointmentCount: totals?.appointmentCount ?? 0,
      byDay,
      byService,
      byBarber,
    };
  }

  async scheduledMinutesByBarber(tenantId: string, from: string, to: string) {
    return this.db
      .select({
        barberId: schema.appointments.barberId,
        minutes: sql<number>`coalesce(sum(${schema.appointments.durationMinutes}), 0)::int`,
      })
      .from(schema.appointments)
      .where(this.notCancelledInRange(tenantId, from, to))
      .groupBy(schema.appointments.barberId);
  }

  async activeBarbers(tenantId: string): Promise<ActiveBarberSchedule[]> {
    const rows = await this.db
      .select({ id: schema.barbers.id, name: schema.barbers.name, workSchedule: schema.barbers.workSchedule })
      .from(schema.barbers)
      .where(and(eq(schema.barbers.tenantId, tenantId), eq(schema.barbers.isActive, true)));
    return rows.map((r) => ({ id: r.id, name: r.name, workSchedule: r.workSchedule as WorkSchedule }));
  }

  async heatmap(tenantId: string, from: string, to: string): Promise<HeatmapCell[]> {
    return this.db
      .select({
        weekday: sql<number>`extract(dow from ${schema.appointments.date}::date)::int`,
        hour: sql<number>`split_part(${schema.appointments.startTime}, ':', 1)::int`,
        count: count(),
      })
      .from(schema.appointments)
      .where(this.notCancelledInRange(tenantId, from, to))
      .groupBy(sql`1`, sql`2`);
  }

  async cancellationCounts(tenantId: string, from: string, to: string) {
    const [row] = await this.db
      .select({
        cancelled: sql<number>`count(*) filter (where ${schema.appointments.status} = 'CANCELLED')::int`,
        total: count(),
      })
      .from(schema.appointments)
      .where(and(
        eq(schema.appointments.tenantId, tenantId),
        gte(schema.appointments.date, from),
        lte(schema.appointments.date, to),
      ));
    return { cancelled: row?.cancelled ?? 0, total: row?.total ?? 0 };
  }

  async newReturningCounts(tenantId: string, from: string, to: string): Promise<NewReturningCounts> {
    const firstVisit = this.db
      .select({
        customerId: schema.appointments.customerId,
        firstDate: sql<string>`min(${schema.appointments.date})`.as('first_date'),
      })
      .from(schema.appointments)
      .where(and(
        eq(schema.appointments.tenantId, tenantId),
        eq(schema.appointments.status, 'COMPLETED'),
        isNotNull(schema.appointments.customerId),
      ))
      .groupBy(schema.appointments.customerId)
      .as('first_visit');

    const byDay = await this.db
      .select({
        date: schema.appointments.date,
        newCount: sql<number>`count(*) filter (where ${firstVisit.firstDate} >= ${from})::int`,
        returningCount: sql<number>`count(*) filter (where ${firstVisit.firstDate} < ${from})::int`,
      })
      .from(schema.appointments)
      .innerJoin(firstVisit, eq(schema.appointments.customerId, firstVisit.customerId))
      .where(and(
        eq(schema.appointments.tenantId, tenantId),
        eq(schema.appointments.status, 'COMPLETED'),
        isNotNull(schema.appointments.customerId),
        gte(schema.appointments.date, from),
        lte(schema.appointments.date, to),
      ))
      .groupBy(schema.appointments.date)
      .orderBy(schema.appointments.date);

    const newCount = byDay.reduce((sum, d) => sum + d.newCount, 0);
    const returningCount = byDay.reduce((sum, d) => sum + d.returningCount, 0);

    return { newCount, returningCount, byDay };
  }

  async inactiveClients(tenantId: string, days: number): Promise<InactiveClient[]> {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    const cutoffDate = cutoff.toISOString().slice(0, 10);

    const lastVisit = this.db
      .select({
        customerId: schema.appointments.customerId,
        lastVisitDate: sql<string>`max(${schema.appointments.date})`.as('last_visit_date'),
      })
      .from(schema.appointments)
      .where(and(
        eq(schema.appointments.tenantId, tenantId),
        eq(schema.appointments.status, 'COMPLETED'),
        isNotNull(schema.appointments.customerId),
      ))
      .groupBy(schema.appointments.customerId)
      .as('last_visit');

    const rows = await this.db
      .select({
        customerId: lastVisit.customerId,
        name: schema.users.name,
        phone: schema.users.phone,
        lastVisitDate: lastVisit.lastVisitDate,
      })
      .from(lastVisit)
      .innerJoin(schema.users, eq(lastVisit.customerId, schema.users.id))
      .where(lt(lastVisit.lastVisitDate, cutoffDate))
      .orderBy(lastVisit.lastVisitDate);

    return rows.map((r) => ({
      customerId: r.customerId as string,
      name: r.name,
      phone: r.phone,
      lastVisitDate: r.lastVisitDate,
    }));
  }
}
