import { Inject, Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(GrantStampUseCase.name);

  constructor(
    @Inject(STAMP_CARD_REPOSITORY) private readonly cardRepo: IStampCardRepository,
    @Inject(STAMP_CARD_CONFIG_REPOSITORY) private readonly configRepo: IStampCardConfigRepository,
    @Inject(CLUB_SUBSCRIPTION_REPOSITORY) private readonly clubSubRepo: IClubSubscriptionRepository,
    @Inject(EventEmitter2) private readonly emitter: EventEmitter2,
  ) {}

  async execute(input: GrantStampInput): Promise<void> {
    // Club subscribers don't accrue stamp-card stamps — the club replaces the stamp-card benefit
    // for as long as the subscription is active (symmetric to ClubSubscriptionBlockedByStampCardError,
    // which blocks activating a club subscription while a stamp card already has progress).
    const activeSubscription = await this.clubSubRepo.findByClientId(input.tenantId, input.clientId);
    if (activeSubscription && activeSubscription.status === 'ACTIVE') {
      this.logger.debug(
        `Skipping stamp accrual: client ${input.clientId} has an active club subscription (stamp card blocked by club subscription)`,
      );
      return;
    }

    const config = await this.configRepo.findByTenantId(input.tenantId);
    if (!config || !config.isServiceEligible(input.serviceId)) return;

    await this.cardRepo.withLock(input.tenantId, input.clientId, async () => {
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
    });
  }
}
