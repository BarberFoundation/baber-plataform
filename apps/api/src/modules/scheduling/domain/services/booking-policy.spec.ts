import { BookingPolicy, BarberScheduleInfo } from './booking-policy';
import { AppointmentConflictError, InvalidAppointmentTimeError } from '../errors/scheduling.errors';
import { defaultWorkSchedule } from '@shared/kernel/value-objects/work-schedule';

const ACTIVE_BARBER: BarberScheduleInfo = {
  isActive: true,
  workSchedule: defaultWorkSchedule(), // mon-fri 09:00-18:00, sat 09:00-13:00, sun off
};

// 2025-03-10 is a Monday
const MONDAY = '2025-03-10';
// 2025-03-09 is a Sunday
const SUNDAY = '2025-03-09';

describe('BookingPolicy', () => {
  const policy = new BookingPolicy();

  it('passes when barber works that day and slot is free', () => {
    expect(() =>
      policy.validate({
        barber: ACTIVE_BARBER,
        date: MONDAY,
        startTime: '09:00',
        endTime: '09:30',
        existing: [],
      }),
    ).not.toThrow();
  });

  it('throws InvalidAppointmentTimeError when barber is inactive', () => {
    expect(() =>
      policy.validate({
        barber: { ...ACTIVE_BARBER, isActive: false },
        date: MONDAY,
        startTime: '09:00',
        endTime: '09:30',
        existing: [],
      }),
    ).toThrow(InvalidAppointmentTimeError);
  });

  it('throws InvalidAppointmentTimeError when barber does not work that day', () => {
    expect(() =>
      policy.validate({
        barber: ACTIVE_BARBER,
        date: SUNDAY,
        startTime: '10:00',
        endTime: '10:30',
        existing: [],
      }),
    ).toThrow(InvalidAppointmentTimeError);
  });

  it('throws InvalidAppointmentTimeError when startTime is before work hours', () => {
    expect(() =>
      policy.validate({
        barber: ACTIVE_BARBER,
        date: MONDAY,
        startTime: '08:00',
        endTime: '08:30',
        existing: [],
      }),
    ).toThrow(InvalidAppointmentTimeError);
  });

  it('throws InvalidAppointmentTimeError when endTime exceeds work hours', () => {
    expect(() =>
      policy.validate({
        barber: ACTIVE_BARBER,
        date: MONDAY,
        startTime: '17:45',
        endTime: '18:15',
        existing: [],
      }),
    ).toThrow(InvalidAppointmentTimeError);
  });

  it('throws AppointmentConflictError when slot overlaps existing appointment', () => {
    expect(() =>
      policy.validate({
        barber: ACTIVE_BARBER,
        date: MONDAY,
        startTime: '09:15',
        endTime: '09:45',
        existing: [{ startTime: '09:00', endTime: '09:30', status: 'CONFIRMED' }],
      }),
    ).toThrow(AppointmentConflictError);
  });

  it('ignores CANCELLED appointments when checking conflicts', () => {
    expect(() =>
      policy.validate({
        barber: ACTIVE_BARBER,
        date: MONDAY,
        startTime: '09:00',
        endTime: '09:30',
        existing: [{ startTime: '09:00', endTime: '09:30', status: 'CANCELLED' }],
      }),
    ).not.toThrow();
  });

  it('allows adjacent slots (no overlap between 09:00-09:30 and 09:30-10:00)', () => {
    expect(() =>
      policy.validate({
        barber: ACTIVE_BARBER,
        date: MONDAY,
        startTime: '09:30',
        endTime: '10:00',
        existing: [{ startTime: '09:00', endTime: '09:30', status: 'CONFIRMED' }],
      }),
    ).not.toThrow();
  });
});
