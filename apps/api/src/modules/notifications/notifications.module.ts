import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@shared/database/database.module';
import { NOTIFICATION_REPOSITORY } from './domain/repositories/notification.repository';
import { DUE_REMINDER_QUERY }      from './domain/repositories/due-reminder.query';
import { WHATSAPP_GATEWAY }        from './domain/ports/whatsapp-gateway.port';

import { NotificationDrizzleRepository } from './infra/repositories/notification-drizzle.repository';
import { DueReminderDrizzleRepository }  from './infra/repositories/due-reminder-drizzle.repository';
import { EvolutionApiWhatsAppGateway }   from './infra/gateways/evolution-api-whatsapp.gateway';
import { StubWhatsAppGateway }           from './infra/gateways/stub-whatsapp.gateway';
import { AppointmentBookedListener }     from './infra/listeners/appointment-booked.listener';
import { AppointmentConfirmedListener }  from './infra/listeners/appointment-confirmed.listener';
import { AppointmentCancelledListener }  from './infra/listeners/appointment-cancelled.listener';
import { ReminderScheduler }             from './infra/schedulers/reminder.scheduler';

import { NotificationsController } from './http/notifications.controller';

import { SendConfirmationNotificationUseCase } from './application/use-cases/send-confirmation-notification.use-case';
import { SendCancellationNotificationUseCase } from './application/use-cases/send-cancellation-notification.use-case';
import { SendReminderNotificationUseCase }     from './application/use-cases/send-reminder-notification.use-case';
import { ListMyNotificationsUseCase }          from './application/use-cases/list-my-notifications.use-case';

@Module({
  imports: [DatabaseModule],
  controllers: [NotificationsController],
  providers: [
    { provide: NOTIFICATION_REPOSITORY, useClass: NotificationDrizzleRepository },
    { provide: DUE_REMINDER_QUERY,      useClass: DueReminderDrizzleRepository },
    {
      provide:    WHATSAPP_GATEWAY,
      useFactory: (config: ConfigService) =>
        config.get('EVOLUTION_API_URL')
          ? new EvolutionApiWhatsAppGateway(config)
          : new StubWhatsAppGateway(),
      inject: [ConfigService],
    },
    SendConfirmationNotificationUseCase,
    SendCancellationNotificationUseCase,
    SendReminderNotificationUseCase,
    ListMyNotificationsUseCase,
    AppointmentBookedListener,
    AppointmentConfirmedListener,
    AppointmentCancelledListener,
    ReminderScheduler,
  ],
  exports: [WHATSAPP_GATEWAY],
})
export class NotificationsModule {}
