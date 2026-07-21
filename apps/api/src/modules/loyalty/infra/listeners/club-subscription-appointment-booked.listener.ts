import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  CLUB_SUBSCRIPTION_REPOSITORY,
  IClubSubscriptionRepository,
} from '../../domain/repositories/club-subscription.repository';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '@shared/events/appointment-events';

@Injectable()
export class ClubSubscriptionAppointmentBookedListener {
  constructor(
    @Inject(CLUB_SUBSCRIPTION_REPOSITORY) private readonly clubSubRepo: IClubSubscriptionRepository,
  ) {}

  @OnEvent(APPOINTMENT_EVENTS.BOOKED)
  async handle(payload: AppointmentEventPayload): Promise<void> {
    if (!payload.customerId) return;
    const subscription = await this.clubSubRepo.findByClientId(payload.tenantId, payload.customerId);
    if (!subscription || subscription.status !== 'ACTIVE') return;
    subscription.consumeQuota(payload.serviceId);
    await this.clubSubRepo.save(subscription);
  }
}
