import { Inject, Injectable } from '@nestjs/common';
import {
  CLUB_SUBSCRIPTION_REPOSITORY,
  IClubSubscriptionRepository,
} from '../../domain/repositories/club-subscription.repository';
import { ClubSubscription } from '../../domain/entities/club-subscription.entity';
import { ClubSubscriptionNotFoundError } from '../../domain/errors/loyalty.errors';

export interface GetMyClubSubscriptionInput {
  tenantId: string;
  clientId: string;
}

@Injectable()
export class GetMyClubSubscriptionUseCase {
  constructor(
    @Inject(CLUB_SUBSCRIPTION_REPOSITORY) private readonly clubSubRepo: IClubSubscriptionRepository,
  ) {}

  async execute(input: GetMyClubSubscriptionInput): Promise<ClubSubscription> {
    const subscription = await this.clubSubRepo.findByClientId(input.tenantId, input.clientId);
    if (!subscription) throw new ClubSubscriptionNotFoundError();
    return subscription;
  }
}
