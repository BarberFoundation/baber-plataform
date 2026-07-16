import { Injectable, Inject } from '@nestjs/common';
import { SCHEDULING_REPOSITORY, ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';
import {
  AppointmentNotFoundError,
  InvalidStatusTransitionError,
  ForbiddenCancellationError,
} from '../../domain/errors/scheduling.errors';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '@shared/events/appointment-events';
import { Role } from '@shared/auth/roles.decorator';

export interface CancelAppointmentInput {
  id: string;
  tenantId: string;
  requestedBy: { userId: string; role: Role };
}

@Injectable()
export class CancelAppointmentUseCase {
  constructor(
    @Inject(SCHEDULING_REPOSITORY) private readonly repo: ISchedulingRepository,
    @Inject(EventEmitter2)         private readonly emitter: EventEmitter2,
  ) {}

  async execute(input: CancelAppointmentInput): Promise<Appointment> {
    const appt = await this.repo.findById(input.id, input.tenantId);
    if (!appt) throw new AppointmentNotFoundError();

    if (input.requestedBy.role !== 'ADMIN' && input.requestedBy.role !== 'RECEPTIONIST') {
      if (appt.customerId !== input.requestedBy.userId) {
        throw new ForbiddenCancellationError();
      }
      const startsAt = new Date(`${appt.date}T${appt.startTime}:00`);
      if (startsAt.getTime() <= Date.now()) {
        throw new ForbiddenCancellationError('Não é possível cancelar um agendamento que já começou.');
      }
    }

    try {
      appt.cancel();
    } catch {
      throw new InvalidStatusTransitionError();
    }
    const saved = await this.repo.save(appt);
    const payload: AppointmentEventPayload = {
      appointmentId: saved.id,
      tenantId:      saved.tenantId,
      clientName:    saved.clientName,
      clientPhone:   saved.clientPhone,
      barberId:      saved.barberId,
      serviceId:     saved.serviceId,
      date:          saved.date,
      startTime:     saved.startTime,
      endTime:       saved.endTime,
    };
    this.emitter.emit(APPOINTMENT_EVENTS.CANCELLED, payload);
    return saved;
  }
}
