import { WorkSchedule } from '@shared/kernel/value-objects/work-schedule';
import { dayOfWeekFromDate, timeToMinutes, timesOverlap } from '../utils/time.utils';
import { AppointmentConflictError, InvalidAppointmentTimeError } from '../errors/scheduling.errors';

export interface BarberScheduleInfo {
  isActive: boolean;
  workSchedule: WorkSchedule;
}

export interface ExistingSlot {
  startTime: string;
  endTime: string;
  status: string;
}

export class BookingPolicy {
  validate(params: {
    barber: BarberScheduleInfo;
    date: string;
    startTime: string;
    endTime: string;
    existing: ExistingSlot[];
  }): void {
    const { barber, date, startTime, endTime, existing } = params;

    if (!barber.isActive) {
      throw new InvalidAppointmentTimeError('Barbeiro inativo.');
    }

    const dow = dayOfWeekFromDate(date);
    const daySchedule = barber.workSchedule[dow];

    if (!daySchedule.isWorking || !daySchedule.startTime || !daySchedule.endTime) {
      throw new InvalidAppointmentTimeError('Barbeiro não trabalha neste dia.');
    }

    if (
      timeToMinutes(startTime) < timeToMinutes(daySchedule.startTime) ||
      timeToMinutes(endTime)   > timeToMinutes(daySchedule.endTime)
    ) {
      throw new InvalidAppointmentTimeError('Horário fora do expediente.');
    }

    const active = existing.filter((e) => e.status !== 'CANCELLED');
    const conflict = active.some((e) =>
      timesOverlap(startTime, endTime, e.startTime, e.endTime),
    );
    if (conflict) {
      throw new AppointmentConflictError();
    }
  }
}
