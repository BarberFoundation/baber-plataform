import { Injectable, Inject } from '@nestjs/common';
import { NOTIFICATION_REPOSITORY, INotificationRepository } from '../../domain/repositories/notification.repository';
import { NotificationLog } from '../../domain/entities/notification-log.entity';

export interface ListMyNotificationsInput {
  tenantId: string;
  customerId: string;
}

@Injectable()
export class ListMyNotificationsUseCase {
  constructor(@Inject(NOTIFICATION_REPOSITORY) private readonly repo: INotificationRepository) {}

  async execute(input: ListMyNotificationsInput): Promise<NotificationLog[]> {
    return this.repo.findByCustomer(input.customerId, input.tenantId);
  }
}
