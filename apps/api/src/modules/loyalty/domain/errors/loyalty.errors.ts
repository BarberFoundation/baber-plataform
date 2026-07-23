import { DomainError } from '@shared/kernel/errors/domain-error';

export class InvalidStampCardConfigError extends DomainError {
  readonly code = 'INVALID_STAMP_CARD_CONFIG';
  constructor(message: string) { super(message); }
}

export class StampCardConfigNotFoundError extends DomainError {
  readonly code = 'STAMP_CARD_CONFIG_NOT_FOUND';
  constructor(message = 'Cartão de fidelidade não configurado para esta barbearia.') { super(message); }
}

export class StampCardNotFoundError extends DomainError {
  readonly code = 'STAMP_CARD_NOT_FOUND';
  constructor(message = 'Cliente ainda não possui cartão de fidelidade.') { super(message); }
}

export class InvalidRedemptionAmountError extends DomainError {
  readonly code = 'INVALID_REDEMPTION_AMOUNT';
  constructor(message = 'Valor de resgate deve ser maior que zero.') { super(message); }
}

export class InsufficientCreditError extends DomainError {
  readonly code = 'INSUFFICIENT_CREDIT';
  constructor(message = 'Saldo de crédito insuficiente.') { super(message); }
}

export class InvalidSubscriptionTierError extends DomainError {
  readonly code = 'INVALID_SUBSCRIPTION_TIER';
  constructor(message: string) { super(message); }
}

export class SubscriptionTierNotFoundError extends DomainError {
  readonly code = 'SUBSCRIPTION_TIER_NOT_FOUND';
  constructor(message = 'Plano de assinatura não configurado para esta barbearia.') { super(message); }
}

export class ClubSubscriptionNotFoundError extends DomainError {
  readonly code = 'CLUB_SUBSCRIPTION_NOT_FOUND';
  constructor(message = 'Cliente não possui assinatura de clube ativa.') { super(message); }
}

export class ClubSubscriptionAlreadyActiveError extends DomainError {
  readonly code = 'CLUB_SUBSCRIPTION_ALREADY_ACTIVE';
  constructor(message = 'Cliente já possui uma assinatura de clube ativa.') { super(message); }
}

export class ClubSubscriptionBlockedByStampCardError extends DomainError {
  readonly code = 'CLUB_SUBSCRIPTION_BLOCKED_BY_STAMP_CARD';
  constructor(message = 'Cliente possui cartão de fidelidade em andamento — resgate ou zere o cartão antes de assinar o clube.') { super(message); }
}

export class StampCardBlockedByClubSubscriptionError extends DomainError {
  readonly code = 'STAMP_CARD_BLOCKED_BY_CLUB_SUBSCRIPTION';
  constructor(message = 'Cliente possui assinatura de clube ativa — não acumula cartão de fidelidade.') { super(message); }
}

export class SubscriptionQuotaExhaustedError extends DomainError {
  readonly code = 'SUBSCRIPTION_QUOTA_EXHAUSTED';
  constructor(message = 'Cota do plano esgotada para este serviço neste ciclo.') { super(message); }
}

export class InvalidPaymentDataError extends DomainError {
  readonly code = 'INVALID_PAYMENT_DATA';
  constructor(message = 'Dados de pagamento inválidos.') { super(message); }
}
