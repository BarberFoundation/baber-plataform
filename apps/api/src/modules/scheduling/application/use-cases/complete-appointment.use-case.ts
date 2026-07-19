import { Injectable, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SCHEDULING_REPOSITORY, ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';
import { AppointmentNotFoundError, InvalidStatusTransitionError } from '../../domain/errors/scheduling.errors';
import { AppointmentActionInput } from './confirm-appointment.use-case';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '@shared/events/appointment-events';

@Injectable()
export class CompleteAppointmentUseCase {
  constructor(
    @Inject(SCHEDULING_REPOSITORY) private readonly repo: ISchedulingRepository,
    @Inject(EventEmitter2)         private readonly emitter: EventEmitter2,
  ) {}

  async execute(input: AppointmentActionInput): Promise<Appointment> {
    const appt = await this.repo.findById(input.id, input.tenantId);
    if (!appt) throw new AppointmentNotFoundError();
    try {
      appt.complete();
    } catch {
      throw new InvalidStatusTransitionError();
    }
    const saved = await this.repo.save(appt);
    const payload: AppointmentEventPayload = {
      appointmentId: saved.id,
      tenantId:      saved.tenantId,
      customerId:    saved.customerId,
      clientName:    saved.clientName,
      clientPhone:   saved.clientPhone,
      barberId:      saved.barberId,
      serviceId:     saved.serviceId,
      date:          saved.date,
      startTime:     saved.startTime,
      endTime:       saved.endTime,
    };
    this.emitter.emit(APPOINTMENT_EVENTS.COMPLETED, payload);
    return saved;
  }
}
