import { DomainError } from '@shared/kernel/errors/domain-error';

export class NotificationFailedError extends DomainError {
  readonly code = 'NOTIFICATION_FAILED';
  constructor(message = 'Falha ao enviar notificação.') { super(message); }
}
