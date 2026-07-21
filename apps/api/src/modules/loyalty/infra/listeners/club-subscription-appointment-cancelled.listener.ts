import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  CLUB_SUBSCRIPTION_REPOSITORY,
  IClubSubscriptionRepository,
} from '../../domain/repositories/club-subscription.repository';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '@shared/events/appointment-events';

const REFUND_WINDOW_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class ClubSubscriptionAppointmentCancelledListener {
  constructor(
    @Inject(CLUB_SUBSCRIPTION_REPOSITORY) private readonly clubSubRepo: IClubSubscriptionRepository,
  ) {}

  @OnEvent(APPOINTMENT_EVENTS.CANCELLED)
  async handle(payload: AppointmentEventPayload): Promise<void> {
    if (!payload.customerId) return;
    const startsAt = new Date(`${payload.date}T${payload.startTime}:00`);
    const cancelledWithEnoughNotice = startsAt.getTime() - Date.now() >= REFUND_WINDOW_MS;
    if (!cancelledWithEnoughNotice) return;

    const subscription = await this.clubSubRepo.findByClientId(payload.tenantId, payload.customerId);
    if (!subscription || subscription.status !== 'ACTIVE') return;
    subscription.refundQuota(payload.serviceId);
    await this.clubSubRepo.save(subscription);
  }
}
