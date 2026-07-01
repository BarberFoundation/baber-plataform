import { Module } from '@nestjs/common';
import { DatabaseModule } from '@shared/database/database.module';

import { TEAM_REPOSITORY } from './domain/repositories/team.repository';
import { TeamDrizzleRepository } from './infra/repositories/team-drizzle.repository';

import { AddBarberUseCase } from './application/use-cases/add-barber.use-case';
import { UpdateBarberUseCase } from './application/use-cases/update-barber.use-case';
import { SetWorkScheduleUseCase } from './application/use-cases/set-work-schedule.use-case';
import { GetBarberUseCase } from './application/use-cases/get-barber.use-case';
import { ListBarbersUseCase } from './application/use-cases/list-barbers.use-case';
import { DeactivateBarberUseCase } from './application/use-cases/deactivate-barber.use-case';

import { TeamController } from './http/team.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [TeamController],
  providers: [
    { provide: TEAM_REPOSITORY, useClass: TeamDrizzleRepository },
    AddBarberUseCase,
    UpdateBarberUseCase,
    SetWorkScheduleUseCase,
    GetBarberUseCase,
    ListBarbersUseCase,
    DeactivateBarberUseCase,
  ],
})
export class TeamModule {}
