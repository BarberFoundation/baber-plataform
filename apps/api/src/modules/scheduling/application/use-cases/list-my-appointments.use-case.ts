import { Injectable, Inject } from '@nestjs/common';
import { SCHEDULING_REPOSITORY, ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';

export interface ListMyAppointmentsInput {
  tenantId: string;
  customerId: string;
}

@Injectable()
export class ListMyAppointmentsUseCase {
  constructor(@Inject(SCHEDULING_REPOSITORY) private readonly repo: ISchedulingRepository) {}

  async execute(input: ListMyAppointmentsInput): Promise<Appointment[]> {
    const appointments = await this.repo.findAll(input.tenantId, { customerId: input.customerId });
    return appointments.sort((a, b) => {
      const aKey = `${a.date}T${a.startTime}`;
      const bKey = `${b.date}T${b.startTime}`;
      return bKey.localeCompare(aKey);
    });
  }
}
