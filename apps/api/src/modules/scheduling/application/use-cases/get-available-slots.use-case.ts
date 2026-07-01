import { Injectable, Inject } from '@nestjs/common';
import { SCHEDULING_REPOSITORY, ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { BARBER_LOOKUP, IBarberLookup } from '../../domain/ports/barber-lookup.port';
import { SERVICE_LOOKUP, IServiceLookup } from '../../domain/ports/service-lookup.port';
import { TimeSlot } from '../../domain/value-objects/time-slot';
import { dayOfWeekFromDate, timeToMinutes, minutesToTime, timesOverlap } from '../../domain/utils/time.utils';

const SLOT_STEP_MINUTES = 30;

export interface GetAvailableSlotsInput {
  tenantId: string;
  barberId: string;
  serviceId: string;
  date: string;
}

@Injectable()
export class GetAvailableSlotsUseCase {
  constructor(
    @Inject(SCHEDULING_REPOSITORY) private readonly repo: ISchedulingRepository,
    @Inject(BARBER_LOOKUP)         private readonly barberLookup: IBarberLookup,
    @Inject(SERVICE_LOOKUP)        private readonly serviceLookup: IServiceLookup,
  ) {}

  async execute(input: GetAvailableSlotsInput): Promise<TimeSlot[]> {
    const [barber, service] = await Promise.all([
      this.barberLookup.findById(input.barberId, input.tenantId),
      this.serviceLookup.findById(input.serviceId, input.tenantId),
    ]);

    if (!barber || !service) return [];

    const dow = dayOfWeekFromDate(input.date);
    const daySchedule = barber.workSchedule[dow];
    if (!daySchedule.isWorking || !daySchedule.startTime || !daySchedule.endTime) return [];

    const workStart = timeToMinutes(daySchedule.startTime);
    const workEnd   = timeToMinutes(daySchedule.endTime);
    const duration  = service.durationMinutes;

    const existing = await this.repo.findByBarberAndDate(input.barberId, input.date, input.tenantId);
    const active   = existing
      .filter((a) => a.status !== 'CANCELLED')
      .map((a) => ({ startTime: a.startTime, endTime: a.endTime }));

    const slots: TimeSlot[] = [];
    for (let t = workStart; t + duration <= workEnd; t += SLOT_STEP_MINUTES) {
      const startTime = minutesToTime(t);
      const endTime   = minutesToTime(t + duration);
      const blocked   = active.some((e) => timesOverlap(startTime, endTime, e.startTime, e.endTime));
      if (!blocked) slots.push({ startTime, endTime });
    }

    return slots;
  }
}
