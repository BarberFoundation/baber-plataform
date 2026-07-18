export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DaySchedule {
  isWorking: boolean;
  startTime: string | null;
  endTime: string | null;
}

export type WorkSchedule = Record<DayOfWeek, DaySchedule>;

export const DAYS_OF_WEEK: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function defaultWorkSchedule(): WorkSchedule {
  return {
    mon: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
    tue: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
    wed: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
    thu: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
    fri: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
    sat: { isWorking: true,  startTime: '09:00', endTime: '13:00' },
    sun: { isWorking: false, startTime: null,     endTime: null     },
  };
}
