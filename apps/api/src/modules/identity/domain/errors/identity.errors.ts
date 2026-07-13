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

export class UserAlreadyExistsError extends DomainError {
  readonly code = 'USER_ALREADY_EXISTS';
  constructor(message = 'Já existe um usuário com estes dados nesta barbearia.') {
    super(message);
  }
}

export class AdminAccountNotFoundError extends DomainError {
  readonly code = 'ADMIN_ACCOUNT_NOT_FOUND';
  constructor(message = 'Conta de administrador não encontrada. Solicite acesso ao responsável pela barbearia.') {
    super(message);
  }
}
