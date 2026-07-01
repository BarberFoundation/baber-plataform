import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '@shared/events/appointment-events';
import { SendCancellationNotificationUseCase } from '../../application/use-cases/send-cancellation-notification.use-case';

@Injectable()
export class AppointmentCancelledListener {
  constructor(private readonly sendCancellation: SendCancellationNotificationUseCase) {}

  @OnEvent(APPOINTMENT_EVENTS.CANCELLED)
  async handle(payload: AppointmentEventPayload): Promise<void> {
    await this.sendCancellation.execute({
      tenantId:      payload.tenantId,
      appointmentId: payload.appointmentId,
      clientName:    payload.clientName,
      clientPhone:   payload.clientPhone,
      date:          payload.date,
      startTime:     payload.startTime,
    });
  }
}
