import { isReminderDue, reminderCandidateDates } from './reminder-window';

// Appointment at 2025-03-11 09:00 → reminder due from 2025-03-10 09:00 (start - 24h)
// until 2025-03-10 13:00 (4h grace), only if booked before 2025-03-10 07:00 (start - 26h).
const APPT = { date: '2025-03-11', startTime: '09:00' };
const bookedEarly = new Date('2025-03-09T10:00:00');

describe('isReminderDue', () => {
  it('is not due before start - 24h', () => {
    expect(
      isReminderDue(APPT, bookedEarly, new Date('2025-03-10T08:59:00')),
    ).toBe(false);
  });

  it('is due exactly at start - 24h', () => {
    expect(
      isReminderDue(APPT, bookedEarly, new Date('2025-03-10T09:00:00')),
    ).toBe(true);
  });

  it('is due within the grace window after start - 24h', () => {
    expect(
      isReminderDue(APPT, bookedEarly, new Date('2025-03-10T12:59:00')),
    ).toBe(true);
  });

  it('is no longer due after the grace window (stale reminder)', () => {
    expect(
      isReminderDue(APPT, bookedEarly, new Date('2025-03-10T13:01:00')),
    ).toBe(false);
  });

  it('is never due when booked less than 26h before start', () => {
    const bookedLate = new Date('2025-03-10T08:00:00');
    expect(
      isReminderDue(APPT, bookedLate, new Date('2025-03-10T09:30:00')),
    ).toBe(false);
  });
});

describe('reminderCandidateDates', () => {
  it('returns the dates 20h and 24h ahead of now', () => {
    // 2025-03-10 22:00 → +20h = 2025-03-11 18:00, +24h = 2025-03-11 22:00 (same day)
    expect(reminderCandidateDates(new Date('2025-03-10T22:00:00'))).toEqual(['2025-03-11']);
  });

  it('returns two dates when the window spans midnight', () => {
    // 2025-03-10 02:00 → +20h = 2025-03-10 22:00, +24h = 2025-03-11 02:00
    expect(reminderCandidateDates(new Date('2025-03-10T02:00:00'))).toEqual([
      '2025-03-10',
      '2025-03-11',
    ]);
  });
});
