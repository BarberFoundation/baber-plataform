import { Injectable, Inject } from '@nestjs/common';
import { TEAM_REPOSITORY, ITeamRepository } from '../../domain/repositories/team.repository';
import { BarberNotFoundError } from '../../domain/errors/team.errors';

export interface DeactivateBarberInput {
  id: string;
  tenantId: string;
}

@Injectable()
export class DeactivateBarberUseCase {
  constructor(
    @Inject(TEAM_REPOSITORY)
    private readonly repo: ITeamRepository,
  ) {}

  async execute(input: DeactivateBarberInput): Promise<void> {
    const barber = await this.repo.findById(input.id, input.tenantId);
    if (!barber) throw new BarberNotFoundError();
    barber.deactivate();
    await this.repo.save(barber);
  }
}
