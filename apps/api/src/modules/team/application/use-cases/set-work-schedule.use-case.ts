import { Injectable, Inject } from '@nestjs/common';
import { TEAM_REPOSITORY, ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';
import { BarberNotFoundError } from '../../domain/errors/team.errors';
import { WorkSchedule } from '../../domain/value-objects/work-schedule';

export interface SetWorkScheduleInput {
  id: string;
  tenantId: string;
  workSchedule: WorkSchedule;
}

@Injectable()
export class SetWorkScheduleUseCase {
  constructor(
    @Inject(TEAM_REPOSITORY)
    private readonly repo: ITeamRepository,
  ) {}

  async execute(input: SetWorkScheduleInput): Promise<Barber> {
    const barber = await this.repo.findById(input.id, input.tenantId);
    if (!barber) throw new BarberNotFoundError();
    barber.setWorkSchedule(input.workSchedule);
    return this.repo.save(barber);
  }
}
