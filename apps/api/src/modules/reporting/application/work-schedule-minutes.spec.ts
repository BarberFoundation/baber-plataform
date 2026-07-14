import { availableMinutesForRange } from './work-schedule-minutes';
import { WorkSchedule } from '../../team/domain/value-objects/work-schedule';

const schedule: WorkSchedule = {
  mon: { isWorking: true,  startTime: '09:00', endTime: '18:00' }, // 540
  tue: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
  wed: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
  thu: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
  fri: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
  sat: { isWorking: true,  startTime: '09:00', endTime: '13:00' }, // 240
  sun: { isWorking: false, startTime: null,    endTime: null },    // 0
};

describe('availableMinutesForRange', () => {
  it('sums working minutes across the range, skipping days off', () => {
    // 2026-07-13 é segunda; seg..dom = 5*540 + 240 + 0 = 2940
    expect(availableMinutesForRange(schedule, '2026-07-13', '2026-07-19')).toBe(2940);
  });

  it('handles a single day', () => {
    expect(availableMinutesForRange(schedule, '2026-07-18', '2026-07-18')).toBe(240); // sábado
  });

  it('returns 0 when every day in range is off', () => {
    expect(availableMinutesForRange(schedule, '2026-07-19', '2026-07-19')).toBe(0); // domingo
  });
});
