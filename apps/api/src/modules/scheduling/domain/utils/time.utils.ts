import { DayOfWeek } from '../../../team/domain/value-objects/work-schedule';

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function addMinutes(time: string, minutes: number): string {
  return minutesToTime(timeToMinutes(time) + minutes);
}

/** Parses 'YYYY-MM-DD' and returns the day of week. Uses midday to avoid DST edge cases. */
export function dayOfWeekFromDate(date: string): DayOfWeek {
  const days: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const d = new Date(date + 'T12:00:00');
  return days[d.getDay()];
}

/** Returns true if [aStart, aEnd) overlaps with [bStart, bEnd). */
export function timesOverlap(
  aStart: string, aEnd: string,
  bStart: string, bEnd: string,
): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) &&
         timeToMinutes(aEnd)   > timeToMinutes(bStart);
}
