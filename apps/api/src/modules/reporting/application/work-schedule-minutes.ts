import { WorkSchedule, DayOfWeek } from '../../team/domain/value-objects/work-schedule';

/** getUTCDay(): 0=domingo ... 6=sábado */
const WEEKDAYS: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

export function availableMinutesForRange(schedule: WorkSchedule, from: string, to: string): number {
  let total = 0;
  const end = new Date(`${to}T00:00:00Z`);
  for (const d = new Date(`${from}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = schedule[WEEKDAYS[d.getUTCDay()]];
    if (day.isWorking && day.startTime && day.endTime) {
      total += minutesBetween(day.startTime, day.endTime);
    }
  }
  return total;
}
