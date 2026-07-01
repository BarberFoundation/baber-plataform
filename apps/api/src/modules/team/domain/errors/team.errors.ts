import { DomainError } from '@shared/kernel/errors/domain-error';

export class BarberNotFoundError extends DomainError {
  readonly code = 'BARBER_NOT_FOUND';
  constructor(message = 'Barbeiro não encontrado.') {
    super(message);
  }
}
