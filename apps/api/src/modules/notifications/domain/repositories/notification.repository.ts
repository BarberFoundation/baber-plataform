import { NotificationLog } from '../entities/notification-log.entity';

export const NOTIFICATION_REPOSITORY = Symbol('INotificationRepository');

export interface INotificationRepository {
  save(log: NotificationLog): Promise<NotificationLog>;
}
