import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '@shared/events/appointment-events';
import { SendConfirmationNotificationUseCase } from '../../application/use-cases/send-confirmation-notification.use-case';

@Injectable()
export class AppointmentConfirmedListener {
  constructor(private readonly sendConfirmation: SendConfirmationNotificationUseCase) {}

  @OnEvent(APPOINTMENT_EVENTS.CONFIRMED)
  async handle(payload: AppointmentEventPayload): Promise<void> {
    await this.sendConfirmation.execute({
      tenantId:      payload.tenantId,
      appointmentId: payload.appointmentId,
      clientName:    payload.clientName,
      clientPhone:   payload.clientPhone,
      date:          payload.date,
      startTime:     payload.startTime,
    });
  }
}
