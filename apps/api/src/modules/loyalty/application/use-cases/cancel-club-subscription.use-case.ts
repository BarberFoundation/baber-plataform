import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CLUB_SUBSCRIPTION_REPOSITORY,
  IClubSubscriptionRepository,
} from '../../domain/repositories/club-subscription.repository';
import { PAYMENT_GATEWAY, IPaymentGateway } from '../../domain/ports/payment-gateway.port';
import { ClubSubscriptionNotFoundError } from '../../domain/errors/loyalty.errors';
import { CLUB_SUBSCRIPTION_EVENTS, ClubSubscriptionCanceledPayload } from '@shared/events/club-subscription-events';

export interface CancelClubSubscriptionInput {
  tenantId: string;
  clientId: string;
}

@Injectable()
export class CancelClubSubscriptionUseCase {
  constructor(
    @Inject(CLUB_SUBSCRIPTION_REPOSITORY) private readonly clubSubRepo: IClubSubscriptionRepository,
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: IPaymentGateway,
    @Inject(EventEmitter2) private readonly emitter: EventEmitter2,
  ) {}

  async execute(input: CancelClubSubscriptionInput): Promise<void> {
    const subscription = await this.clubSubRepo.findByClientId(input.tenantId, input.clientId);
    if (!subscription) throw new ClubSubscriptionNotFoundError();
    if (subscription.status === 'CANCELED') return;

    await this.paymentGateway.cancelSubscription(subscription.asaasSubscriptionId);
    subscription.cancel();
    await this.clubSubRepo.save(subscription);

    const payload: ClubSubscriptionCanceledPayload = { tenantId: input.tenantId, clientId: input.clientId };
    this.emitter.emit(CLUB_SUBSCRIPTION_EVENTS.CANCELED, payload);
  }
}
