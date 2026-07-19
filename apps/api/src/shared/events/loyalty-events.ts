export const LOYALTY_EVENTS = {
  STAMP_ADDED:          'loyalty.stamp_card.stamp_added',
  STAMP_CARD_COMPLETED: 'loyalty.stamp_card.completed',
  CREDIT_REDEEMED:      'loyalty.stamp_card.credit_redeemed',
} as const;

export interface StampCardStampAddedPayload {
  tenantId:       string;
  clientId:       string;
  currentStamps:  number;
  stampsRequired: number;
}

export interface StampCardCompletedPayload {
  tenantId:                  string;
  clientId:                  string;
  creditEarnedInCents:       number;
  totalCreditBalanceInCents: number;
}

export interface StampCardCreditRedeemedPayload {
  tenantId:                string;
  clientId:                string;
  amountInCents:           number;
  remainingBalanceInCents: number;
}
