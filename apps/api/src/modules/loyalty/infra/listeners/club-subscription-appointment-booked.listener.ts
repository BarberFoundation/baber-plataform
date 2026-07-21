import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  CLUB_SUBSCRIPTION_REPOSITORY,
  IClubSubscriptionRepository,
} from '../../domain/repositories/club-subscription.repository';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '@shared/events/appointment-events';

@Injectable()
export class ClubSubscriptionAppointmentBookedListener {
  private readonly logger = new Logger(ClubSubscriptionAppointmentBookedListener.name);

  constructor(
    @Inject(CLUB_SUBSCRIPTION_REPOSITORY) private readonly clubSubRepo: IClubSubscriptionRepository,
  ) {}

  @OnEvent(APPOINTMENT_EVENTS.BOOKED)
  async handle(payload: AppointmentEventPayload): Promise<void> {
    if (!payload.customerId) return;
    const subscription = await this.clubSubRepo.findByClientId(payload.tenantId, payload.customerId);
    if (!subscription || subscription.status !== 'ACTIVE') return;

    try {
      subscription.consumeQuota(payload.serviceId);
      await this.clubSubRepo.save(subscription);
    } catch (error) {
      // appointment.booked is emitted via emit() (fire-and-forget, not emitAsync()), so a
      // rejection here becomes an unhandled promise rejection at the process level. Quota
      // exhaustion isn't gated at booking time yet, so this is a reachable, non-exceptional
      // path — degrade to a no-op rather than crashing the process for every tenant.
      this.logger.error(
        `Failed to consume club subscription quota for client ${payload.customerId} (service ${payload.serviceId}): ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
