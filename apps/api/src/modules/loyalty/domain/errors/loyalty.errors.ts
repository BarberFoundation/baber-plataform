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
