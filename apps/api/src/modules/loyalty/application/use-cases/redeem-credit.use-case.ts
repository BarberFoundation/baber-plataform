import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { STAMP_CARD_REPOSITORY, IStampCardRepository } from '../../domain/repositories/stamp-card.repository';
import { StampCardNotFoundError } from '../../domain/errors/loyalty.errors';
import { LOYALTY_EVENTS, StampCardCreditRedeemedPayload } from '@shared/events/loyalty-events';

export interface RedeemCreditInput {
  tenantId: string;
  clientId: string;
  amountInCents: number;
}

@Injectable()
export class RedeemCreditUseCase {
  constructor(
    @Inject(STAMP_CARD_REPOSITORY) private readonly cardRepo: IStampCardRepository,
    @Inject(EventEmitter2) private readonly emitter: EventEmitter2,
  ) {}

  async execute(input: RedeemCreditInput): Promise<void> {
    const card = await this.cardRepo.findByClientId(input.tenantId, input.clientId);
    if (!card) throw new StampCardNotFoundError();

    card.redeemCredit(input.amountInCents);
    await this.cardRepo.save(card);

    const payload: StampCardCreditRedeemedPayload = {
      tenantId: input.tenantId,
      clientId: input.clientId,
      amountInCents: input.amountInCents,
      remainingBalanceInCents: card.creditBalanceInCents,
    };
    this.emitter.emit(LOYALTY_EVENTS.CREDIT_REDEEMED, payload);
  }
}
