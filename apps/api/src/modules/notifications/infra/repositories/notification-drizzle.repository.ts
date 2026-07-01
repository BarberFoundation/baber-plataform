import { Inject, Injectable } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { INotificationRepository } from '../../domain/repositories/notification.repository';
import { NotificationLog } from '../../domain/entities/notification-log.entity';

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
}
