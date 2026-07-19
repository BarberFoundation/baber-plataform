import { Inject, Injectable } from '@nestjs/common';
import { STAMP_CARD_REPOSITORY, IStampCardRepository } from '../../domain/repositories/stamp-card.repository';
import {
  STAMP_CARD_CONFIG_REPOSITORY,
  IStampCardConfigRepository,
} from '../../domain/repositories/stamp-card-config.repository';

export interface GetMyStampCardInput {
  tenantId: string;
  clientId: string;
}

export interface MyStampCardView {
  currentStamps: number;
  stampsRequired: number | null;
  creditBalanceInCents: number;
}

@Injectable()
export class GetMyStampCardUseCase {
  constructor(
    @Inject(STAMP_CARD_REPOSITORY) private readonly cardRepo: IStampCardRepository,
    @Inject(STAMP_CARD_CONFIG_REPOSITORY) private readonly configRepo: IStampCardConfigRepository,
  ) {}

  async execute(input: GetMyStampCardInput): Promise<MyStampCardView> {
    const [card, config] = await Promise.all([
      this.cardRepo.findByClientId(input.tenantId, input.clientId),
      this.configRepo.findByTenantId(input.tenantId),
    ]);
    return {
      currentStamps: card?.currentStamps ?? 0,
      stampsRequired: config?.stampsRequired ?? null,
      creditBalanceInCents: card?.creditBalanceInCents ?? 0,
    };
  }
}
