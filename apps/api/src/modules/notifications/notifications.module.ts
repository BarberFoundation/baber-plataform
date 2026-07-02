import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '@shared/database/database.module';
import { NOTIFICATION_REPOSITORY } from './domain/repositories/notification.repository';
import { WHATSAPP_GATEWAY }        from './domain/ports/whatsapp-gateway.port';

import { NotificationDrizzleRepository } from './infra/repositories/notification-drizzle.repository';
import { EvolutionApiWhatsAppGateway }   from './infra/gateways/evolution-api-whatsapp.gateway';
import { StubWhatsAppGateway }           from './infra/gateways/stub-whatsapp.gateway';
import { AppointmentBookedListener }     from './infra/listeners/appointment-booked.listener';
import { AppointmentConfirmedListener }  from './infra/listeners/appointment-confirmed.listener';
import { AppointmentCancelledListener }  from './infra/listeners/appointment-cancelled.listener';
import { ReminderProcessor }             from './infra/processors/reminder.processor';
import { REMINDER_QUEUE }               from './infra/queues/reminder.queue';

import { SendConfirmationNotificationUseCase } from './application/use-cases/send-confirmation-notification.use-case';
import { SendCancellationNotificationUseCase } from './application/use-cases/send-cancellation-notification.use-case';
import { SendReminderNotificationUseCase }     from './application/use-cases/send-reminder-notification.use-case';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({ name: REMINDER_QUEUE }),
  ],
  providers: [
    { provide: NOTIFICATION_REPOSITORY, useClass: NotificationDrizzleRepository },
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
    AppointmentBookedListener,
    AppointmentConfirmedListener,
    AppointmentCancelledListener,
    ReminderProcessor,
  ],
  exports: [WHATSAPP_GATEWAY],
})
export class NotificationsModule {}
