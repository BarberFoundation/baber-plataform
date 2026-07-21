import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { STAMP_CARD_REPOSITORY, IStampCardRepository } from '../../domain/repositories/stamp-card.repository';
import {
  STAMP_CARD_CONFIG_REPOSITORY,
  IStampCardConfigRepository,
} from '../../domain/repositories/stamp-card-config.repository';
import {
  CLUB_SUBSCRIPTION_REPOSITORY,
  IClubSubscriptionRepository,
} from '../../domain/repositories/club-subscription.repository';
import { StampCard } from '../../domain/entities/stamp-card.entity';
import {
  LOYALTY_EVENTS,
  StampCardStampAddedPayload,
  StampCardCompletedPayload,
} from '@shared/events/loyalty-events';

export interface GrantStampInput {
  tenantId: string;
  clientId: string;
  serviceId: string;
}

@Injectable()
export class GrantStampUseCase {
  constructor(
    @Inject(STAMP_CARD_REPOSITORY) private readonly cardRepo: IStampCardRepository,
    @Inject(STAMP_CARD_CONFIG_REPOSITORY) private readonly configRepo: IStampCardConfigRepository,
    @Inject(CLUB_SUBSCRIPTION_REPOSITORY) private readonly clubSubRepo: IClubSubscriptionRepository,
    @Inject(EventEmitter2) private readonly emitter: EventEmitter2,
  ) {}

  async execute(input: GrantStampInput): Promise<void> {
    const activeSubscription = await this.clubSubRepo.findByClientId(input.tenantId, input.clientId);
    if (activeSubscription && activeSubscription.status === 'ACTIVE') return;

    const config = await this.configRepo.findByTenantId(input.tenantId);
    if (!config || !config.isServiceEligible(input.serviceId)) return;

    const existing = await this.cardRepo.findByClientId(input.tenantId, input.clientId);
    const card = existing ?? StampCard.createNew(input.tenantId, input.clientId);

    const result = card.addStamp(config.stampsRequired, config.creditValueInCents);
    await this.cardRepo.save(card);

    const addedPayload: StampCardStampAddedPayload = {
      tenantId: input.tenantId,
      clientId: input.clientId,
      currentStamps: card.currentStamps,
      stampsRequired: config.stampsRequired,
    };
    this.emitter.emit(LOYALTY_EVENTS.STAMP_ADDED, addedPayload);

    if (result.completed) {
      const completedPayload: StampCardCompletedPayload = {
        tenantId: input.tenantId,
        clientId: input.clientId,
        creditEarnedInCents: result.creditEarnedInCents,
        totalCreditBalanceInCents: card.creditBalanceInCents,
      };
      this.emitter.emit(LOYALTY_EVENTS.STAMP_CARD_COMPLETED, completedPayload);
    }
  }
}
