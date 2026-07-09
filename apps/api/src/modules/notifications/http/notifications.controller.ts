import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '@shared/auth/current-user.decorator';
import { JwtPayload } from '@shared/auth/jwt-token.service';
import { Roles } from '@shared/auth/roles.decorator';
import { ListMyNotificationsUseCase } from '../application/use-cases/list-my-notifications.use-case';
import { NotificationLog } from '../domain/entities/notification-log.entity';

function serializeNotification(n: NotificationLog) {
  return {
    id:            n.id,
    appointmentId: n.appointmentId,
    type:          n.type,
    message:       n.message,
    status:        n.status,
    sentAt:        n.sentAt,
    createdAt:     n.createdAt,
  };
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly listMyNotifications: ListMyNotificationsUseCase) {}

  @Roles('CLIENT')
  @Get('my')
  async myNotifications(@CurrentUser() user: JwtPayload) {
    const logs = await this.listMyNotifications.execute({ tenantId: user.tenantId, customerId: user.userId });
    return logs.map(serializeNotification);
  }
}
