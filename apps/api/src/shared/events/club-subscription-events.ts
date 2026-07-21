export const CLUB_SUBSCRIPTION_EVENTS = {
  ACTIVATED:        'loyalty.club_subscription.activated',
  RENEWED:          'loyalty.club_subscription.renewed',
  CANCELED:         'loyalty.club_subscription.canceled',
  PAYMENT_FAILED:   'loyalty.club_subscription.payment_failed',
  PAYMENT_RECOVERED:'loyalty.club_subscription.payment_recovered',
  QUOTA_EXHAUSTED:  'loyalty.club_subscription.quota_exhausted',
} as const;

export interface ClubSubscriptionActivatedPayload {
  tenantId: string;
  clientId: string;
  tier: string;
  priceInCents: number;
}

export interface ClubSubscriptionRenewedPayload {
  tenantId: string;
  clientId: string;
  cycleStart: string;
  cycleEnd: string;
}

export interface ClubSubscriptionCanceledPayload {
  tenantId: string;
  clientId: string;
}

export interface SubscriptionPaymentFailedPayload {
  tenantId: string;
  clientId: string;
  asaasSubscriptionId: string;
}

export interface SubscriptionPaymentRecoveredPayload {
  tenantId: string;
  clientId: string;
  asaasSubscriptionId: string;
}

export interface SubscriptionQuotaExhaustedPayload {
  tenantId: string;
  clientId: string;
  serviceId: string;
}
