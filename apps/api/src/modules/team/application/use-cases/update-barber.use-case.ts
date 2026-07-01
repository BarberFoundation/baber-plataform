import { Injectable, Inject } from '@nestjs/common';
import { TEAM_REPOSITORY, ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';
import { BarberNotFoundError } from '../../domain/errors/team.errors';

export interface UpdateBarberInput {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
}

@Injectable()
export class UpdateBarberUseCase {
  constructor(
    @Inject(TEAM_REPOSITORY)
    private readonly repo: ITeamRepository,
  ) {}

  async execute(input: UpdateBarberInput): Promise<Barber> {
    const barber = await this.repo.findById(input.id, input.tenantId);
    if (!barber) throw new BarberNotFoundError();
    barber.update(input.name, input.phone);
    return this.repo.save(barber);
  }
}
