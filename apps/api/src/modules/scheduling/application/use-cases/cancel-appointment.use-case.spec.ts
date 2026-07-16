import { CancelAppointmentUseCase } from './cancel-appointment.use-case';
import { ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';
import {
  AppointmentNotFoundError,
  InvalidStatusTransitionError,
  ForbiddenCancellationError,
} from '../../domain/errors/scheduling.errors';

const MOCK_EMITTER: any = { emit: jest.fn() };

function makeAppt(status: Appointment['status'] = 'PENDING') {
  return Appointment.reconstitute({
    id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1', customerId: null,
    clientName: 'João', clientPhone: '+55', date: '2025-03-10',
    startTime: '09:00', endTime: '09:30', durationMinutes: 30, priceInCents: 3000,
    status, notes: null, createdAt: new Date(), updatedAt: new Date(),
  });
}

function makeRepo(appt: Appointment | null = makeAppt()): ISchedulingRepository {
  return {
    findById: jest.fn().mockResolvedValue(appt),
    findAll: jest.fn().mockResolvedValue([]),
    findByBarberAndDate: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation(async (a: Appointment) => a),
  };
}

describe('CancelAppointmentUseCase', () => {
  const ADMIN = { userId: 'admin-1', role: 'ADMIN' as const };

  it('cancels a PENDING appointment', async () => {
    const repo = makeRepo();
    const uc = new CancelAppointmentUseCase(repo, MOCK_EMITTER);
    const result = await uc.execute({ id: 'appt-1', tenantId: 'tenant-1', requestedBy: ADMIN });
    expect(result.status).toBe('CANCELLED');
  });

  it('cancels a CONFIRMED appointment', async () => {
    const uc = new CancelAppointmentUseCase(makeRepo(makeAppt('CONFIRMED')), MOCK_EMITTER);
    const result = await uc.execute({ id: 'appt-1', tenantId: 'tenant-1', requestedBy: ADMIN });
    expect(result.status).toBe('CANCELLED');
  });

  it('throws AppointmentNotFoundError when not found', async () => {
    const uc = new CancelAppointmentUseCase(makeRepo(null), MOCK_EMITTER);
    await expect(uc.execute({ id: 'x', tenantId: 'tenant-1', requestedBy: ADMIN })).rejects.toBeInstanceOf(AppointmentNotFoundError);
  });

  it('throws InvalidStatusTransitionError when appointment is COMPLETED', async () => {
    const uc = new CancelAppointmentUseCase(makeRepo(makeAppt('COMPLETED')), MOCK_EMITTER);
    await expect(uc.execute({ id: 'appt-1', tenantId: 'tenant-1', requestedBy: ADMIN })).rejects.toBeInstanceOf(InvalidStatusTransitionError);
  });

  it('allows the owning customer to cancel their own future PENDING appointment', async () => {
    const future = Appointment.reconstitute({
      id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
      customerId: 'user-1', clientName: 'Ana', clientPhone: '+55',
      date: '2999-01-01', startTime: '09:00', endTime: '09:30', durationMinutes: 30, priceInCents: 3000,
      status: 'PENDING', notes: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const repo = { findById: jest.fn().mockResolvedValue(future), findAll: jest.fn(), findByBarberAndDate: jest.fn(), save: jest.fn().mockImplementation(async (a) => a) };
    const uc = new CancelAppointmentUseCase(repo as any, MOCK_EMITTER);
    const result = await uc.execute({ id: 'appt-1', tenantId: 'tenant-1', requestedBy: { userId: 'user-1', role: 'CLIENT' } });
    expect(result.status).toBe('CANCELLED');
  });

  it('throws ForbiddenCancellationError when a different customer tries to cancel', async () => {
    const future = Appointment.reconstitute({
      id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
      customerId: 'user-1', clientName: 'Ana', clientPhone: '+55',
      date: '2999-01-01', startTime: '09:00', endTime: '09:30', durationMinutes: 30, priceInCents: 3000,
      status: 'PENDING', notes: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const repo = { findById: jest.fn().mockResolvedValue(future), findAll: jest.fn(), findByBarberAndDate: jest.fn(), save: jest.fn() };
    const uc = new CancelAppointmentUseCase(repo as any, MOCK_EMITTER);
    await expect(
      uc.execute({ id: 'appt-1', tenantId: 'tenant-1', requestedBy: { userId: 'user-2', role: 'CLIENT' } }),
    ).rejects.toBeInstanceOf(ForbiddenCancellationError);
  });

  it('throws ForbiddenCancellationError when the customer tries to cancel a past appointment', async () => {
    const past = Appointment.reconstitute({
      id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
      customerId: 'user-1', clientName: 'Ana', clientPhone: '+55',
      date: '2000-01-01', startTime: '09:00', endTime: '09:30', durationMinutes: 30, priceInCents: 3000,
      status: 'PENDING', notes: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const repo = { findById: jest.fn().mockResolvedValue(past), findAll: jest.fn(), findByBarberAndDate: jest.fn(), save: jest.fn() };
    const uc = new CancelAppointmentUseCase(repo as any, MOCK_EMITTER);
    await expect(
      uc.execute({ id: 'appt-1', tenantId: 'tenant-1', requestedBy: { userId: 'user-1', role: 'CLIENT' } }),
    ).rejects.toBeInstanceOf(ForbiddenCancellationError);
  });

  it('allows ADMIN to cancel regardless of ownership', async () => {
    const future = Appointment.reconstitute({
      id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
      customerId: 'user-1', clientName: 'Ana', clientPhone: '+55',
      date: '2999-01-01', startTime: '09:00', endTime: '09:30', durationMinutes: 30, priceInCents: 3000,
      status: 'PENDING', notes: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const repo = { findById: jest.fn().mockResolvedValue(future), findAll: jest.fn(), findByBarberAndDate: jest.fn(), save: jest.fn().mockImplementation(async (a) => a) };
    const uc = new CancelAppointmentUseCase(repo as any, MOCK_EMITTER);
    const result = await uc.execute({ id: 'appt-1', tenantId: 'tenant-1', requestedBy: { userId: 'admin-1', role: 'ADMIN' } });
    expect(result.status).toBe('CANCELLED');
  });

  it('allows RECEPTIONIST to cancel regardless of ownership', async () => {
    const future = Appointment.reconstitute({
      id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
      customerId: 'user-1', clientName: 'Ana', clientPhone: '+55',
      date: '2999-01-01', startTime: '09:00', endTime: '09:30', durationMinutes: 30, priceInCents: 3000,
      status: 'PENDING', notes: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const repo = { findById: jest.fn().mockResolvedValue(future), findAll: jest.fn(), findByBarberAndDate: jest.fn(), save: jest.fn().mockImplementation(async (a) => a) };
    const uc = new CancelAppointmentUseCase(repo as any, MOCK_EMITTER);
    const result = await uc.execute({ id: 'appt-1', tenantId: 'tenant-1', requestedBy: { userId: 'recep-1', role: 'RECEPTIONIST' } });
    expect(result.status).toBe('CANCELLED');
  });
});
