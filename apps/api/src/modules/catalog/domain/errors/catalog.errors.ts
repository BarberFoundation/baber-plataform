import { DomainError } from '@shared/kernel/errors/domain-error';

export class ServiceNotFoundError extends DomainError {
  readonly code = 'SERVICE_NOT_FOUND';
  constructor(message = 'Serviço não encontrado.') {
    super(message);
  }
}

export class ServiceNameTakenError extends DomainError {
  readonly code = 'SERVICE_NAME_TAKEN';
  constructor(message = 'Já existe um serviço com este nome neste tenant.') {
    super(message);
  }
}
