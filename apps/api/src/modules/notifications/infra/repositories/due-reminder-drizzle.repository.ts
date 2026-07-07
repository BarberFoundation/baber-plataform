import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, notExists } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { IDueReminderQuery, DueReminder } from '../../domain/repositories/due-reminder.query';
import { isReminderDue, reminderCandidateDates } from './reminder-window';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class DueReminderDrizzleRepository implements IDueReminderQuery {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async findDue(now: Date): Promise<DueReminder[]> {
    const { appointments, notificationLogs } = schema;

    const candidates = await this.db
      .select({
        id:          appointments.id,
        tenantId:    appointments.tenantId,
        clientName:  appointments.clientName,
        clientPhone: appointments.clientPhone,
        date:        appointments.date,
        startTime:   appointments.startTime,
        createdAt:   appointments.createdAt,
      })
      .from(appointments)
      .where(
        and(
          inArray(appointments.date, reminderCandidateDates(now)),
          inArray(appointments.status, ['PENDING', 'CONFIRMED']),
          notExists(
            this.db
              .select({ id: notificationLogs.id })
              .from(notificationLogs)
              .where(
                and(
                  eq(notificationLogs.appointmentId, appointments.id),
                  eq(notificationLogs.type, 'REMINDER'),
                ),
              ),
          ),
        ),
      );

    return candidates
      .filter((a) => isReminderDue({ date: a.date, startTime: a.startTime }, a.createdAt, now))
      .map((a) => ({
        tenantId:      a.tenantId,
        appointmentId: a.id,
        clientName:    a.clientName,
        clientPhone:   a.clientPhone,
        date:          a.date,
        startTime:     a.startTime,
      }));
  }
}
