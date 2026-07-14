import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import {
  ISchedulingRepository,
  ListAppointmentsFilter,
} from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';
import { AppointmentStatus } from '../../domain/value-objects/appointment-status';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class SchedulingDrizzleRepository implements ISchedulingRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async findById(id: string, tenantId: string): Promise<Appointment | null> {
    const rows = await this.db
      .select()
      .from(schema.appointments)
      .where(and(eq(schema.appointments.id, id), eq(schema.appointments.tenantId, tenantId)))
      .limit(1);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async findAll(tenantId: string, filter: ListAppointmentsFilter): Promise<Appointment[]> {
    const conditions = [eq(schema.appointments.tenantId, tenantId)];
    if (filter.date)     conditions.push(eq(schema.appointments.date,     filter.date));
    if (filter.barberId) conditions.push(eq(schema.appointments.barberId, filter.barberId));
    if (filter.status)   conditions.push(eq(schema.appointments.status,   filter.status));
    if (filter.customerId) conditions.push(eq(schema.appointments.customerId, filter.customerId));
    const rows = await this.db
      .select()
      .from(schema.appointments)
      .where(and(...conditions));
    return rows.map((r) => this.toEntity(r));
  }

  async findByBarberAndDate(barberId: string, date: string, tenantId: string): Promise<Appointment[]> {
    const rows = await this.db
      .select()
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.tenantId, tenantId),
          eq(schema.appointments.barberId, barberId),
          eq(schema.appointments.date,     date),
        ),
      );
    return rows.map((r) => this.toEntity(r));
  }

  async save(appointment: Appointment): Promise<Appointment> {
    const updatedAt = appointment.updatedAt;
    await this.db
      .insert(schema.appointments)
      .values({
        id:              appointment.id,
        tenantId:        appointment.tenantId,
        barberId:        appointment.barberId,
        serviceId:       appointment.serviceId,
        customerId:      appointment.customerId,
        clientName:      appointment.clientName,
        clientPhone:     appointment.clientPhone,
        date:            appointment.date,
        startTime:       appointment.startTime,
        endTime:         appointment.endTime,
        durationMinutes: appointment.durationMinutes,
        priceInCents:    appointment.priceInCents,
        status:          appointment.status,
        notes:           appointment.notes,
        createdAt:       appointment.createdAt,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: schema.appointments.id,
        set: {
          status:    appointment.status,
          notes:     appointment.notes,
          updatedAt,
        },
      });

    return Appointment.reconstitute({
      id:              appointment.id,
      tenantId:        appointment.tenantId,
      barberId:        appointment.barberId,
      serviceId:       appointment.serviceId,
      customerId:      appointment.customerId,
      clientName:      appointment.clientName,
      clientPhone:     appointment.clientPhone,
      date:            appointment.date,
      startTime:       appointment.startTime,
      endTime:         appointment.endTime,
      durationMinutes: appointment.durationMinutes,
      priceInCents:    appointment.priceInCents,
      status:          appointment.status,
      notes:           appointment.notes,
      createdAt:       appointment.createdAt,
      updatedAt,
    });
  }

  private toEntity(row: typeof schema.appointments.$inferSelect): Appointment {
    return Appointment.reconstitute({
      id:              row.id,
      tenantId:        row.tenantId,
      barberId:        row.barberId,
      serviceId:       row.serviceId,
      customerId:      row.customerId ?? null,
      clientName:      row.clientName,
      clientPhone:     row.clientPhone,
      date:            row.date,
      startTime:       row.startTime,
      endTime:         row.endTime,
      durationMinutes: row.durationMinutes,
      priceInCents:    row.priceInCents,
      status:          row.status as AppointmentStatus,
      notes:           row.notes ?? null,
      createdAt:       row.createdAt,
      updatedAt:       row.updatedAt,
    });
  }
}
