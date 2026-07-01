import { BookAppointmentUseCase, BookAppointmentInput } from './book-appointment.use-case';
import { ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { IBarberLookup } from '../../domain/ports/barber-lookup.port';
import { IServiceLookup } from '../../domain/ports/service-lookup.port';
import { Appointment } from '../../domain/entities/appointment.entity';
import { AppointmentConflictError, InvalidAppointmentTimeError } from '../../domain/errors/scheduling.errors';
import { defaultWorkSchedule } from '../../../team/domain/value-objects/work-schedule';

const MONDAY = '2025-03-10';

const MOCK_EMITTER: any = { emit: jest.fn() };

const ACTIVE_BARBER = {
  isActive: true,
  workSchedule: defaultWorkSchedule(),
};

const ACTIVE_SERVICE = { durationMinutes: 30, isActive: true };

function makeRepo(overrides?: Partial<ISchedulingRepository>): ISchedulingRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findByBarberAndDate: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation(async (a: Appointment) => a),
    ...overrides,
  };
}

function makeBarberLookup(result = ACTIVE_BARBER): IBarberLookup {
  return { findById: jest.fn().mockResolvedValue(result) };
}

function makeServiceLookup(result = ACTIVE_SERVICE): IServiceLookup {
  return { findById: jest.fn().mockResolvedValue(result) };
}

const INPUT: BookAppointmentInput = {
  tenantId: 'tenant-1',
  barberId: 'barber-1',
  serviceId: 'service-1',
  clientName: 'João Cliente',
  clientPhone: '+5511999999999',
  date: MONDAY,
  startTime: '09:00',
};

describe('BookAppointmentUseCase', () => {
  it('creates and saves appointment with computed endTime', async () => {
    const repo = makeRepo();
    const uc = new BookAppointmentUseCase(repo, makeBarberLookup(), makeServiceLookup(), MOCK_EMITTER);
    const result = await uc.execute(INPUT);
    expect(result.status).toBe('PENDING');
    expect(result.startTime).toBe('09:00');
    expect(result.endTime).toBe('09:30');
    expect(result.durationMinutes).toBe(30);
    expect(repo.save).toHaveBeenCalledWith(expect.any(Appointment));
  });

  it('throws InvalidAppointmentTimeError when barber not found', async () => {
    const repo = makeRepo();
    const uc = new BookAppointmentUseCase(repo, makeBarberLookup(null as any), makeServiceLookup(), MOCK_EMITTER);
    await expect(uc.execute(INPUT)).rejects.toBeInstanceOf(InvalidAppointmentTimeError);
  });

  it('throws InvalidAppointmentTimeError when service not found', async () => {
    const repo = makeRepo();
    const uc = new BookAppointmentUseCase(repo, makeBarberLookup(), makeServiceLookup(null as any), MOCK_EMITTER);
    await expect(uc.execute(INPUT)).rejects.toBeInstanceOf(InvalidAppointmentTimeError);
  });

  it('throws InvalidAppointmentTimeError when barber does not work that day', async () => {
    const repo = makeRepo();
    const uc = new BookAppointmentUseCase(repo, makeBarberLookup(), makeServiceLookup(), MOCK_EMITTER);
    await expect(uc.execute({ ...INPUT, date: '2025-03-09' })).rejects.toBeInstanceOf(InvalidAppointmentTimeError);
  });

  it('throws AppointmentConflictError when slot is taken', async () => {
    const existing = Appointment.reconstitute({
      id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
      clientName: 'Ana', clientPhone: '+5511888888888',
      date: MONDAY, startTime: '09:00', endTime: '09:30', durationMinutes: 30,
      status: 'CONFIRMED', notes: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const repo = makeRepo({ findByBarberAndDate: jest.fn().mockResolvedValue([existing]) });
    const uc = new BookAppointmentUseCase(repo, makeBarberLookup(), makeServiceLookup(), MOCK_EMITTER);
    await expect(uc.execute(INPUT)).rejects.toBeInstanceOf(AppointmentConflictError);
  });
});
