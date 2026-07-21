import { ClubSubscription } from '../entities/club-subscription.entity';

export const CLUB_SUBSCRIPTION_REPOSITORY = Symbol('IClubSubscriptionRepository');

export interface IClubSubscriptionRepository {
  findByClientId(tenantId: string, clientId: string): Promise<ClubSubscription | null>;
  findByAsaasSubscriptionId(asaasSubscriptionId: string): Promise<ClubSubscription | null>;
  save(subscription: ClubSubscription): Promise<ClubSubscription>;
}
