import { Injectable, Inject } from '@nestjs/common';
import { SCHEDULING_REPOSITORY, ISchedulingRepository, ListAppointmentsFilter } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';
import { AppointmentStatus } from '../../domain/value-objects/appointment-status';

export interface ListAppointmentsInput {
  tenantId: string;
  date?: string;
  barberId?: string;
  status?: AppointmentStatus;
}

@Injectable()
export class ListAppointmentsUseCase {
  constructor(@Inject(SCHEDULING_REPOSITORY) private readonly repo: ISchedulingRepository) {}

  async execute(input: ListAppointmentsInput): Promise<Appointment[]> {
    const filter: ListAppointmentsFilter = {
      date:     input.date,
      barberId: input.barberId,
      status:   input.status,
    };
    return this.repo.findAll(input.tenantId, filter);
  }
}
