import { Injectable, Inject } from '@nestjs/common';
import { TEAM_REPOSITORY, ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';

export interface ListBarbersInput {
  tenantId: string;
  includeInactive: boolean;
}

@Injectable()
export class ListBarbersUseCase {
  constructor(
    @Inject(TEAM_REPOSITORY)
    private readonly repo: ITeamRepository,
  ) {}

  async execute(input: ListBarbersInput): Promise<Barber[]> {
    return this.repo.findAll(input.tenantId, input.includeInactive);
  }
}
