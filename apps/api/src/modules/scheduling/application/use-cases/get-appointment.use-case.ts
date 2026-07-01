import { Injectable, Inject } from '@nestjs/common';
import { SCHEDULING_REPOSITORY, ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';
import { AppointmentNotFoundError } from '../../domain/errors/scheduling.errors';

@Injectable()
export class GetAppointmentUseCase {
  constructor(@Inject(SCHEDULING_REPOSITORY) private readonly repo: ISchedulingRepository) {}

  async execute(input: { id: string; tenantId: string }): Promise<Appointment> {
    const appt = await this.repo.findById(input.id, input.tenantId);
    if (!appt) throw new AppointmentNotFoundError();
    return appt;
  }
}
