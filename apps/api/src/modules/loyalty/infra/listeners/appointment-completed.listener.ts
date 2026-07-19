import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '@shared/events/appointment-events';
import { GrantStampUseCase } from '../../application/use-cases/grant-stamp.use-case';

@Injectable()
export class AppointmentCompletedListener {
  constructor(private readonly grantStamp: GrantStampUseCase) {}

  @OnEvent(APPOINTMENT_EVENTS.COMPLETED)
  async handle(payload: AppointmentEventPayload): Promise<void> {
    if (!payload.customerId) return;
    await this.grantStamp.execute({
      tenantId: payload.tenantId,
      clientId: payload.customerId,
      serviceId: payload.serviceId,
    });
  }
}
