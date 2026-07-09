import { Inject, Injectable } from '@nestjs/common';
import { and, eq, desc } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { INotificationRepository } from '../../domain/repositories/notification.repository';
import { NotificationLog } from '../../domain/entities/notification-log.entity';
import { NotificationType } from '../../domain/value-objects/notification-type';
import { NotificationStatus } from '../../domain/value-objects/notification-status';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class NotificationDrizzleRepository implements INotificationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async save(log: NotificationLog): Promise<NotificationLog> {
    await this.db
      .insert(schema.notificationLogs)
      .values({
        id:            log.id,
        tenantId:      log.tenantId,
        appointmentId: log.appointmentId,
        type:          log.type,
        phone:         log.phone,
        message:       log.message,
        status:        log.status,
        sentAt:        log.sentAt,
        error:         log.error,
        createdAt:     log.createdAt,
      })
      .onConflictDoUpdate({
        target: schema.notificationLogs.id,
        set: {
          status: log.status,
          sentAt: log.sentAt,
          error:  log.error,
        },
      });
    return log;
  }

  async findByCustomer(customerId: string, tenantId: string): Promise<NotificationLog[]> {
    const rows = await this.db
      .select({
        id:            schema.notificationLogs.id,
        tenantId:      schema.notificationLogs.tenantId,
        appointmentId: schema.notificationLogs.appointmentId,
        type:          schema.notificationLogs.type,
        phone:         schema.notificationLogs.phone,
        message:       schema.notificationLogs.message,
        status:        schema.notificationLogs.status,
        sentAt:        schema.notificationLogs.sentAt,
        error:         schema.notificationLogs.error,
        createdAt:     schema.notificationLogs.createdAt,
      })
      .from(schema.notificationLogs)
      .innerJoin(schema.appointments, eq(schema.appointments.id, schema.notificationLogs.appointmentId))
      .where(and(
        eq(schema.appointments.customerId, customerId),
        eq(schema.notificationLogs.tenantId, tenantId),
      ))
      .orderBy(desc(schema.notificationLogs.createdAt));

    return rows.map((r) =>
      NotificationLog.reconstitute({
        id:            r.id,
        tenantId:      r.tenantId,
        appointmentId: r.appointmentId,
        type:          r.type as NotificationType,
        phone:         r.phone,
        message:       r.message,
        status:        r.status as NotificationStatus,
        sentAt:        r.sentAt,
        error:         r.error,
        createdAt:     r.createdAt,
      }),
    );
  }
}
