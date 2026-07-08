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

function makeBarberLookup(result = ACTIVE_BARBER, activeList: any[] = [{ id: 'barber-1', ...ACTIVE_BARBER }]): IBarberLookup {
  return {
    findById: jest.fn().mockResolvedValue(result),
    listActiveByTenant: jest.fn().mockResolvedValue(activeList),
  };
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
      id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1', customerId: null,
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
      id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1', customerId: null,
      clientName: 'Ana', clientPhone: '+55', date: MONDAY,
      startTime: '09:00', endTime: '09:30', durationMinutes: 30,
      status: 'CONFIRMED', notes: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const uc = new GetAvailableSlotsUseCase(makeRepo([existing]), makeBarberLookup(), makeServiceLookup(30));
    const slots = await uc.execute(INPUT);
    const has0930 = slots.some((s) => s.startTime === '09:30');
    expect(has0930).toBe(true);
  });

  it('aggregates slots across all active barbers when barberId is omitted', async () => {
    const barberA = { id: 'barber-a', isActive: true, workSchedule: defaultWorkSchedule() };
    const barberB = { id: 'barber-b', isActive: true, workSchedule: defaultWorkSchedule() };
    const busyA = Appointment.reconstitute({
      id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-a', serviceId: 'service-1', customerId: null,
      clientName: 'Ana', clientPhone: '+55', date: MONDAY,
      startTime: '09:00', endTime: '09:30', durationMinutes: 30,
      status: 'CONFIRMED', notes: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const repo: ISchedulingRepository = {
      findById: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
      findByBarberAndDate: jest.fn().mockImplementation(async (barberId: string) =>
        barberId === 'barber-a' ? [busyA] : [],
      ),
      save: jest.fn(),
    };
    const uc = new GetAvailableSlotsUseCase(
      repo,
      makeBarberLookup(ACTIVE_BARBER, [barberA, barberB]),
      makeServiceLookup(30),
    );
    const { barberId, ...rest } = INPUT;
    const slots = await uc.execute(rest);
    expect(slots.some((s) => s.startTime === '09:00')).toBe(true);
  });

  it('returns empty array when no active barbers exist and barberId is omitted', async () => {
    const repo = makeRepo();
    const uc = new GetAvailableSlotsUseCase(repo, makeBarberLookup(ACTIVE_BARBER, []), makeServiceLookup(30));
    const { barberId, ...rest } = INPUT;
    const slots = await uc.execute(rest);
    expect(slots).toEqual([]);
  });
});
