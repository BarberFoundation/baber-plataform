import { Injectable, Inject } from '@nestjs/common';
import { NOTIFICATION_REPOSITORY, INotificationRepository } from '../../domain/repositories/notification.repository';
import { WHATSAPP_GATEWAY, IWhatsAppGateway } from '../../domain/ports/whatsapp-gateway.port';
import { NotificationLog } from '../../domain/entities/notification-log.entity';

export interface SendConfirmationInput {
  tenantId:      string;
  appointmentId: string;
  clientName:    string;
  clientPhone:   string;
  date:          string;
  startTime:     string;
}

@Injectable()
export class SendConfirmationNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly repo:    INotificationRepository,
    @Inject(WHATSAPP_GATEWAY)        private readonly gateway: IWhatsAppGateway,
  ) {}

  async execute(input: SendConfirmationInput): Promise<void> {
    const message = `Olá ${input.clientName}! Seu agendamento foi marcado para ${input.date} às ${input.startTime}. Até logo! 💈`;
    const log = NotificationLog.create({
      tenantId:      input.tenantId,
      appointmentId: input.appointmentId,
      type:          'CONFIRMATION',
      phone:         input.clientPhone,
      message,
    });

    try {
      await this.gateway.send(input.clientPhone, message);
      log.markSent();
    } catch (err) {
      log.markFailed(err instanceof Error ? err.message : String(err));
    }

    await this.repo.save(log);
  }
}
