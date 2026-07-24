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
    // A row is reused across activate/cancel/reactivate cycles (unique tenant+client
    // constraint), so a CANCELED row still exists here — treat it as "no subscription"
    // like a client who never subscribed, otherwise the client app shows a canceled
    // plan as active after re-fetching (e.g. navigating back into the screen).
    if (!subscription || subscription.status === 'CANCELED') throw new ClubSubscriptionNotFoundError();
    return subscription;
  }
}
