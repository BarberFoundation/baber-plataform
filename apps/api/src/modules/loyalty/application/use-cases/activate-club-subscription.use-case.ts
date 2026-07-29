// apps/api/src/modules/loyalty/application/use-cases/activate-club-subscription.use-case.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  SUBSCRIPTION_TIER_REPOSITORY,
  ISubscriptionTierRepository,
} from '../../domain/repositories/subscription-tier.repository';
import {
  CLUB_SUBSCRIPTION_REPOSITORY,
  IClubSubscriptionRepository,
} from '../../domain/repositories/club-subscription.repository';
import { STAMP_CARD_REPOSITORY, IStampCardRepository } from '../../domain/repositories/stamp-card.repository';
import { CATALOG_REPOSITORY, ICatalogRepository } from '../../../catalog/domain/repositories/catalog.repository';
import { PAYMENT_GATEWAY, IPaymentGateway, PixQrCode } from '../../domain/ports/payment-gateway.port';
import { ClubSubscription } from '../../domain/entities/club-subscription.entity';
import {
  SubscriptionTierNotFoundError,
  ClubSubscriptionAlreadyActiveError,
  ClubSubscriptionBlockedByStampCardError,
} from '../../domain/errors/loyalty.errors';
import { CLUB_SUBSCRIPTION_EVENTS, ClubSubscriptionActivatedPayload } from '@shared/events/club-subscription-events';
import { todayInSaoPaulo, firstDayOfNextMonth, endOfMonth } from '../../domain/utils/date.utils';
import { proratedChargeInCents } from '../../domain/utils/pricing.utils';

export interface ActivateClubSubscriptionInput {
  tenantId: string;
  clientId: string;
  tierId: string;
  cpfCnpj: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface ActivateClubSubscriptionOutput {
  subscription: ClubSubscription;
  payment: { paymentId: string; pix: PixQrCode } | null;
}

interface GatewaySubscriptionResult {
  customerId: string;
  subscriptionId: string;
  payment: { paymentId: string; pix: PixQrCode } | null;
}

@Injectable()
export class ActivateClubSubscriptionUseCase {
  private readonly logger = new Logger(ActivateClubSubscriptionUseCase.name);

  constructor(
    @Inject(SUBSCRIPTION_TIER_REPOSITORY) private readonly tierRepo: ISubscriptionTierRepository,
    @Inject(CLUB_SUBSCRIPTION_REPOSITORY) private readonly clubSubRepo: IClubSubscriptionRepository,
    @Inject(STAMP_CARD_REPOSITORY) private readonly stampCardRepo: IStampCardRepository,
    @Inject(CATALOG_REPOSITORY) private readonly catalogRepo: ICatalogRepository,
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: IPaymentGateway,
    @Inject(EventEmitter2) private readonly emitter: EventEmitter2,
  ) {}

  async execute(input: ActivateClubSubscriptionInput): Promise<ActivateClubSubscriptionOutput> {
    const tier = await this.tierRepo.findById(input.tierId, input.tenantId);
    if (!tier || !tier.isActive) throw new SubscriptionTierNotFoundError();

    const existing = await this.clubSubRepo.findByClientId(input.tenantId, input.clientId);
    if (existing && existing.status === 'ACTIVE') throw new ClubSubscriptionAlreadyActiveError();

    const stampCard = await this.stampCardRepo.findByClientId(input.tenantId, input.clientId);
    if (stampCard && (stampCard.currentStamps > 0 || stampCard.creditBalanceInCents > 0)) {
      throw new ClubSubscriptionBlockedByStampCardError();
    }

    const catalogPrices = new Map<string, number>();
    for (const item of tier.services) {
      const service = await this.catalogRepo.findById(item.serviceId, input.tenantId);
      if (service) catalogPrices.set(item.serviceId, service.priceInCents);
    }
    const monthlyPriceInCents = tier.calculatePriceInCents(catalogPrices);
    const todayStr = todayInSaoPaulo();

    const { customerId, subscriptionId, payment } = await this.chargeAndSubscribe(input, tier.name, monthlyPriceInCents, todayStr);

    const cycleEnd = endOfMonth(firstDayOfNextMonth(todayStr));
    const quotas = tier.services.map((s) => ({ serviceId: s.serviceId, quantityTotal: s.quantity, quantityConsumed: 0 }));

    let subscription: ClubSubscription;
    if (existing) {
      existing.reactivate(tier.id, customerId, subscriptionId, todayStr, cycleEnd, quotas);
      subscription = existing;
    } else {
      subscription = ClubSubscription.createNew({
        tenantId: input.tenantId,
        clientId: input.clientId,
        tierId: tier.id,
        asaasCustomerId: customerId,
        asaasSubscriptionId: subscriptionId,
        currentCycleStart: todayStr,
        currentCycleEnd: cycleEnd,
        quotas,
      });
    }

    const saved = await this.clubSubRepo.save(subscription);

    const payload: ClubSubscriptionActivatedPayload = {
      tenantId: input.tenantId, clientId: input.clientId, tier: tier.name, priceInCents: monthlyPriceInCents,
    };
    this.emitter.emit(CLUB_SUBSCRIPTION_EVENTS.ACTIVATED, payload);

    return { subscription: saved, payment };
  }

  /** Creates the gateway customer, charges the pro-rata amount (if any), and opens the recurring subscription. */
  private async chargeAndSubscribe(
    input: ActivateClubSubscriptionInput,
    tierName: string,
    monthlyPriceInCents: number,
    todayStr: string,
  ): Promise<GatewaySubscriptionResult> {
    const { customerId } = await this.paymentGateway.createCustomer({
      name: input.name, cpfCnpj: input.cpfCnpj, email: input.email, phone: input.phone,
    });

    const proratedInCents = proratedChargeInCents(monthlyPriceInCents, todayStr);

    let payment: { paymentId: string; pix: PixQrCode } | null = null;
    if (proratedInCents > 0) {
      const { paymentId } = await this.paymentGateway.createOneOffCharge({
        customerId,
        billingType: 'UNDEFINED',
        valueInCents: proratedInCents,
        dueDate: todayStr,
        description: `Adesão pro-rata — clube ${tierName}`,
      });
      try {
        const pix = await this.paymentGateway.getPixQrCode(paymentId);
        payment = { paymentId, pix };
      } catch (err) {
        this.logger.warn(`Failed to fetch PIX QR code for payment ${paymentId}: ${(err as Error).message}`);
      }
    }

    const nextDueDate = firstDayOfNextMonth(todayStr);
    const { subscriptionId } = await this.paymentGateway.createSubscription({
      customerId,
      billingType: 'UNDEFINED',
      valueInCents: monthlyPriceInCents,
      nextDueDate,
      description: `Clube ${tierName}`,
    });

    return { customerId, subscriptionId, payment };
  }
}
