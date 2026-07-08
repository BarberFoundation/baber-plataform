import { DomainError } from '@shared/kernel/errors/domain-error';

export class AppointmentNotFoundError extends DomainError {
  readonly code = 'APPOINTMENT_NOT_FOUND';
  constructor(message = 'Agendamento não encontrado.') { super(message); }
}

export class AppointmentConflictError extends DomainError {
  readonly code = 'APPOINTMENT_CONFLICT';
  constructor(message = 'Horário já ocupado para este barbeiro.') { super(message); }
}

export class InvalidAppointmentTimeError extends DomainError {
  readonly code = 'INVALID_APPOINTMENT_TIME';
  constructor(message = 'Horário fora do expediente do barbeiro.') { super(message); }
}

export class InvalidStatusTransitionError extends DomainError {
  readonly code = 'INVALID_STATUS_TRANSITION';
  constructor(message = 'Transição de status inválida.') { super(message); }
}

export class NoBarberAvailableError extends DomainError {
  readonly code = 'NO_BARBER_AVAILABLE';
  constructor(message = 'Nenhum barbeiro disponível neste horário.') { super(message); }
}
