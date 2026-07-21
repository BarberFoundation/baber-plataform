// apps/api/src/modules/loyalty/application/use-cases/handle-payment-webhook.use-case.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CLUB_SUBSCRIPTION_REPOSITORY,
  IClubSubscriptionRepository,
} from '../../domain/repositories/club-subscription.repository';
import {
  SUBSCRIPTION_TIER_REPOSITORY,
  ISubscriptionTierRepository,
} from '../../domain/repositories/subscription-tier.repository';
import {
  CLUB_SUBSCRIPTION_EVENTS,
  ClubSubscriptionRenewedPayload,
  SubscriptionPaymentFailedPayload,
} from '@shared/events/club-subscription-events';

export interface PaymentWebhookInput {
  event: string;
  subscriptionId: string | null;
}

const RENEWAL_EVENTS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);
const FAILURE_EVENTS = new Set(['PAYMENT_OVERDUE', 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED']);

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Injectable()
export class HandlePaymentWebhookUseCase {
  private readonly logger = new Logger(HandlePaymentWebhookUseCase.name);

  constructor(
    @Inject(CLUB_SUBSCRIPTION_REPOSITORY) private readonly clubSubRepo: IClubSubscriptionRepository,
    @Inject(SUBSCRIPTION_TIER_REPOSITORY) private readonly tierRepo: ISubscriptionTierRepository,
    @Inject(EventEmitter2) private readonly emitter: EventEmitter2,
  ) {}

  async execute(input: PaymentWebhookInput): Promise<void> {
    if (!input.subscriptionId) return;
    if (!RENEWAL_EVENTS.has(input.event) && !FAILURE_EVENTS.has(input.event)) return;

    const subscription = await this.clubSubRepo.findByAsaasSubscriptionId(input.subscriptionId);
    if (!subscription) {
      this.logger.warn(`Webhook for unknown Asaas subscription ${input.subscriptionId}`);
      return;
    }

    if (RENEWAL_EVENTS.has(input.event)) {
      const tier = await this.tierRepo.findById(subscription.tierId, subscription.tenantId);
      if (!tier) {
        this.logger.error(`Tier ${subscription.tierId} missing for renewal of subscription ${input.subscriptionId}`);
        return;
      }

      const cycleStart = new Date(subscription.currentCycleEnd);
      cycleStart.setDate(cycleStart.getDate() + 1);
      const cycleEnd = new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, 0);

      subscription.renew(
        toLocalDateString(cycleStart),
        toLocalDateString(cycleEnd),
        tier.services.map((s) => ({ serviceId: s.serviceId, quantityTotal: s.quantity })),
      );
      await this.clubSubRepo.save(subscription);

      const payload: ClubSubscriptionRenewedPayload = {
        tenantId: subscription.tenantId,
        clientId: subscription.clientId,
        cycleStart: subscription.currentCycleStart,
        cycleEnd: subscription.currentCycleEnd,
      };
      this.emitter.emit(CLUB_SUBSCRIPTION_EVENTS.RENEWED, payload);
      return;
    }

    subscription.markPastDue();
    await this.clubSubRepo.save(subscription);

    const payload: SubscriptionPaymentFailedPayload = {
      tenantId: subscription.tenantId,
      clientId: subscription.clientId,
      asaasSubscriptionId: input.subscriptionId,
    };
    this.emitter.emit(CLUB_SUBSCRIPTION_EVENTS.PAYMENT_FAILED, payload);
  }
}
