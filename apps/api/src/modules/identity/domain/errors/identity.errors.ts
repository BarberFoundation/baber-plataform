import { DomainError } from '@shared/kernel/errors/domain-error';

export class InvalidFirebaseTokenError extends DomainError {
  readonly code = 'INVALID_FIREBASE_TOKEN';
  constructor(message = 'Firebase token inválido ou expirado.') {
    super(message);
  }
}

export class UserNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND';
  constructor(message = 'Usuário não encontrado.') {
    super(message);
  }
}

export class InvalidRefreshTokenError extends DomainError {
  readonly code = 'INVALID_REFRESH_TOKEN';
  constructor(message = 'Refresh token inválido, expirado ou revogado.') {
    super(message);
  }
}

export class OtpRateLimitedError extends DomainError {
  readonly code = 'OTP_RATE_LIMITED';
  constructor(message = 'Muitas tentativas. Tente novamente mais tarde.') {
    super(message);
  }
}

export class InvalidOtpError extends DomainError {
  readonly code = 'INVALID_OTP';
  constructor(message = 'Código inválido ou expirado.') {
    super(message);
  }
}

export class TenantNotFoundError extends DomainError {
  readonly code = 'TENANT_NOT_FOUND';
  constructor(message = 'Barbearia não encontrada.') {
    super(message);
  }
}

export class FirebaseAccountTenantMismatchError extends DomainError {
  readonly code = 'FIREBASE_ACCOUNT_TENANT_MISMATCH';
  constructor(message = 'Esta conta já está vinculada a outra barbearia.') {
    super(message);
  }
}
