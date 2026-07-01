import { Module } from '@nestjs/common';
import { DatabaseModule } from '@shared/database/database.module';

import { SCHEDULING_REPOSITORY } from './domain/repositories/scheduling.repository';
import { BARBER_LOOKUP }         from './domain/ports/barber-lookup.port';
import { SERVICE_LOOKUP }        from './domain/ports/service-lookup.port';

import { SchedulingDrizzleRepository } from './infra/repositories/scheduling-drizzle.repository';
import { BarberLookupAdapter }         from './infra/adapters/barber-lookup.adapter';
import { ServiceLookupAdapter }        from './infra/adapters/service-lookup.adapter';

import { BookAppointmentUseCase }     from './application/use-cases/book-appointment.use-case';
import { GetAvailableSlotsUseCase }   from './application/use-cases/get-available-slots.use-case';
import { ConfirmAppointmentUseCase }  from './application/use-cases/confirm-appointment.use-case';
import { CancelAppointmentUseCase }   from './application/use-cases/cancel-appointment.use-case';
import { CompleteAppointmentUseCase } from './application/use-cases/complete-appointment.use-case';
import { GetAppointmentUseCase }      from './application/use-cases/get-appointment.use-case';
import { ListAppointmentsUseCase }    from './application/use-cases/list-appointments.use-case';

import { SchedulingController } from './http/scheduling.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [SchedulingController],
  providers: [
    { provide: SCHEDULING_REPOSITORY, useClass: SchedulingDrizzleRepository },
    { provide: BARBER_LOOKUP,         useClass: BarberLookupAdapter },
    { provide: SERVICE_LOOKUP,        useClass: ServiceLookupAdapter },
    BookAppointmentUseCase,
    GetAvailableSlotsUseCase,
    ConfirmAppointmentUseCase,
    CancelAppointmentUseCase,
    CompleteAppointmentUseCase,
    GetAppointmentUseCase,
    ListAppointmentsUseCase,
  ],
})
export class SchedulingModule {}
