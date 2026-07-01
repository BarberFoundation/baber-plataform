import { Injectable, Inject } from '@nestjs/common';
import { TEAM_REPOSITORY, ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';
import { BarberNotFoundError } from '../../domain/errors/team.errors';

export interface GetBarberInput {
  id: string;
  tenantId: string;
}

@Injectable()
export class GetBarberUseCase {
  constructor(
    @Inject(TEAM_REPOSITORY)
    private readonly repo: ITeamRepository,
  ) {}

  async execute(input: GetBarberInput): Promise<Barber> {
    const barber = await this.repo.findById(input.id, input.tenantId);
    if (!barber) throw new BarberNotFoundError();
    return barber;
  }
}
