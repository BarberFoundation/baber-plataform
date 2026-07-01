import { Injectable, Inject } from '@nestjs/common';
import { TEAM_REPOSITORY, ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';
import { WorkSchedule } from '../../domain/value-objects/work-schedule';

export interface AddBarberInput {
  tenantId: string;
  name: string;
  phone?: string | null;
  workSchedule?: WorkSchedule;
}

@Injectable()
export class AddBarberUseCase {
  constructor(
    @Inject(TEAM_REPOSITORY)
    private readonly repo: ITeamRepository,
  ) {}

  async execute(input: AddBarberInput): Promise<Barber> {
    const barber = Barber.create({
      tenantId: input.tenantId,
      name: input.name,
      phone: input.phone ?? null,
      workSchedule: input.workSchedule,
    });
    return this.repo.save(barber);
  }
}
