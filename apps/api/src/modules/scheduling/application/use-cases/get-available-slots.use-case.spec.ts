import { GetAvailableSlotsUseCase, GetAvailableSlotsInput } from './get-available-slots.use-case';
import { ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { IBarberLookup } from '../../domain/ports/barber-lookup.port';
import { IServiceLookup } from '../../domain/ports/service-lookup.port';
import { Appointment } from '../../domain/entities/appointment.entity';
import { defaultWorkSchedule } from '../../../team/domain/value-objects/work-schedule';

const MONDAY = '2025-03-10';

const ACTIVE_BARBER = {
  isActive: true,
  workSchedule: defaultWorkSchedule(),
};

function makeRepo(existing: Appointment[] = []): ISchedulingRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findByBarberAndDate: jest.fn().mockResolvedValue(existing),
    save: jest.fn(),
  };
}

function makeBarberLookup(result = ACTIVE_BARBER): IBarberLookup {
  return { findById: jest.fn().mockResolvedValue(result) };
}

function makeServiceLookup(durationMinutes = 30): IServiceLookup {
  return { findById: jest.fn().mockResolvedValue({ durationMinutes, isActive: true }) };
}

const INPUT: GetAvailableSlotsInput = {
  tenantId: 'tenant-1',
  barberId: 'barber-1',
  serviceId: 'service-1',
  date: MONDAY,
};

describe('GetAvailableSlotsUseCase', () => {
  it('returns slots within work hours for a 30-min service', async () => {
    const uc = new GetAvailableSlotsUseCase(makeRepo(), makeBarberLookup(), makeServiceLookup(30));
    const slots = await uc.execute(INPUT);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]).toEqual({ startTime: '09:00', endTime: '09:30' });
    expect(slots[slots.length - 1]).toEqual({ startTime: '17:30', endTime: '18:00' });
  });

  it('returns empty array when barber does not work that day (Sunday)', async () => {
    const uc = new GetAvailableSlotsUseCase(makeRepo(), makeBarberLookup(), makeServiceLookup(30));
    const slots = await uc.execute({ ...INPUT, date: '2025-03-09' });
    expect(slots).toEqual([]);
  });

  it('returns empty array when barber not found', async () => {
    const uc = new GetAvailableSlotsUseCase(makeRepo(), makeBarberLookup(null as any), makeServiceLookup(30));
    const slots = await uc.execute(INPUT);
    expect(slots).toEqual([]);
  });

  it('excludes slots that overlap with existing appointments', async () => {
    const existing = Appointment.reconstitute({
      id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
      clientName: 'Ana', clientPhone: '+55', date: MONDAY,
      startTime: '09:00', endTime: '09:30', durationMinutes: 30,
      status: 'CONFIRMED', notes: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const uc = new GetAvailableSlotsUseCase(makeRepo([existing]), makeBarberLookup(), makeServiceLookup(30));
    const slots = await uc.execute(INPUT);
    const has0900 = slots.some((s) => s.startTime === '09:00');
    expect(has0900).toBe(false);
    expect(slots[0].startTime).toBe('09:30');
  });

  it('includes slots adjacent to existing appointments', async () => {
    const existing = Appointment.reconstitute({
      id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
      clientName: 'Ana', clientPhone: '+55', date: MONDAY,
      startTime: '09:00', endTime: '09:30', durationMinutes: 30,
      status: 'CONFIRMED', notes: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const uc = new GetAvailableSlotsUseCase(makeRepo([existing]), makeBarberLookup(), makeServiceLookup(30));
    const slots = await uc.execute(INPUT);
    const has0930 = slots.some((s) => s.startTime === '09:30');
    expect(has0930).toBe(true);
  });
});
