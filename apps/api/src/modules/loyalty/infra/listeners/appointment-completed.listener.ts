import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '@shared/events/appointment-events';
import { GrantStampUseCase } from '../../application/use-cases/grant-stamp.use-case';

@Injectable()
export class AppointmentCompletedListener {
  private readonly logger = new Logger(AppointmentCompletedListener.name);

  constructor(private readonly grantStamp: GrantStampUseCase) {}

  @OnEvent(APPOINTMENT_EVENTS.COMPLETED)
  async handle(payload: AppointmentEventPayload): Promise<void> {
    if (!payload.customerId) return;
    try {
      await this.grantStamp.execute({
        tenantId: payload.tenantId,
        clientId: payload.customerId,
        serviceId: payload.serviceId,
      });
    } catch (error) {
      // appointment.completed is emitted via emit() (fire-and-forget, not emitAsync()), so a
      // rejection here becomes an unhandled promise rejection at the process level.
      this.logger.error(
        `Failed to grant stamp for client ${payload.customerId} (service ${payload.serviceId}): ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
