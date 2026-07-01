import { Injectable, Inject } from '@nestjs/common';
import { NOTIFICATION_REPOSITORY, INotificationRepository } from '../../domain/repositories/notification.repository';
import { WHATSAPP_GATEWAY, IWhatsAppGateway } from '../../domain/ports/whatsapp-gateway.port';
import { NotificationLog } from '../../domain/entities/notification-log.entity';

export interface SendCancellationInput {
  tenantId:      string;
  appointmentId: string;
  clientName:    string;
  clientPhone:   string;
  date:          string;
  startTime:     string;
}

@Injectable()
export class SendCancellationNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly repo:    INotificationRepository,
    @Inject(WHATSAPP_GATEWAY)        private readonly gateway: IWhatsAppGateway,
  ) {}

  async execute(input: SendCancellationInput): Promise<void> {
    const message = `Olá ${input.clientName}! Seu agendamento de ${input.date} às ${input.startTime} foi cancelado.`;
    const log = NotificationLog.create({
      tenantId:      input.tenantId,
      appointmentId: input.appointmentId,
      type:          'CANCELLATION',
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
