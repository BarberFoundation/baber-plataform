import { Injectable, Inject } from '@nestjs/common';
import { SCHEDULING_REPOSITORY, ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { BARBER_LOOKUP, IBarberLookup, ActiveBarber } from '../../domain/ports/barber-lookup.port';
import { SERVICE_LOOKUP, IServiceLookup } from '../../domain/ports/service-lookup.port';
import { TimeSlot } from '../../domain/value-objects/time-slot';
import { dayOfWeekFromDate, timeToMinutes, minutesToTime, timesOverlap } from '../../domain/utils/time.utils';

const SLOT_STEP_MINUTES = 30;

export interface GetAvailableSlotsInput {
  tenantId: string;
  barberId?: string;
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
    const service = await this.serviceLookup.findById(input.serviceId, input.tenantId);
    if (!service) return [];

    if (input.barberId) {
      const barber = await this.barberLookup.findById(input.barberId, input.tenantId);
      if (!barber) return [];
      return this.slotsForBarber(input.barberId, barber, input.date, service.durationMinutes, input.tenantId);
    }

    const activeBarbers = await this.barberLookup.listActiveByTenant(input.tenantId);
    if (activeBarbers.length === 0) return [];

    const perBarberSlots = await Promise.all(
      activeBarbers.map((b) => this.slotsForBarber(b.id, b, input.date, service.durationMinutes, input.tenantId)),
    );

    const merged = new Map<string, TimeSlot>();
    for (const slots of perBarberSlots) {
      for (const s of slots) merged.set(s.startTime, s);
    }
    return Array.from(merged.values()).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }

  private async slotsForBarber(
    barberId: string,
    barber: ActiveBarber | { isActive: boolean; workSchedule: ActiveBarber['workSchedule'] },
    date: string,
    duration: number,
    tenantId: string,
  ): Promise<TimeSlot[]> {
    const dow = dayOfWeekFromDate(date);
    const daySchedule = barber.workSchedule[dow];
    if (!daySchedule.isWorking || !daySchedule.startTime || !daySchedule.endTime) return [];

    const workStart = timeToMinutes(daySchedule.startTime);
    const workEnd   = timeToMinutes(daySchedule.endTime);

    const existing = await this.repo.findByBarberAndDate(barberId, date, tenantId);
    const active = existing
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
