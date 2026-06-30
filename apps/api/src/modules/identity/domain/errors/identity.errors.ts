import { DomainError } from '@shared/kernel/errors/domain-error';

export class InvalidFirebaseTokenError extends DomainError {
  readonly code = 'INVALID_FIREBASE_TOKEN';
}

export class UserNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND';
}

export class InvalidRefreshTokenError extends DomainError {
  readonly code = 'INVALID_REFRESH_TOKEN';
}
