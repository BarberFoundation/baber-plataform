import { CancelAppointmentUseCase } from './cancel-appointment.use-case';
import { ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';
import { AppointmentNotFoundError, InvalidStatusTransitionError } from '../../domain/errors/scheduling.errors';

const MOCK_EMITTER: any = { emit: jest.fn() };

function makeAppt(status: Appointment['status'] = 'PENDING') {
  return Appointment.reconstitute({
    id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1', customerId: null,
    clientName: 'João', clientPhone: '+55', date: '2025-03-10',
    startTime: '09:00', endTime: '09:30', durationMinutes: 30,
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
  it('cancels a PENDING appointment', async () => {
    const repo = makeRepo();
    const uc = new CancelAppointmentUseCase(repo, MOCK_EMITTER);
    const result = await uc.execute({ id: 'appt-1', tenantId: 'tenant-1' });
    expect(result.status).toBe('CANCELLED');
  });

  it('cancels a CONFIRMED appointment', async () => {
    const uc = new CancelAppointmentUseCase(makeRepo(makeAppt('CONFIRMED')), MOCK_EMITTER);
    const result = await uc.execute({ id: 'appt-1', tenantId: 'tenant-1' });
    expect(result.status).toBe('CANCELLED');
  });

  it('throws AppointmentNotFoundError when not found', async () => {
    const uc = new CancelAppointmentUseCase(makeRepo(null), MOCK_EMITTER);
    await expect(uc.execute({ id: 'x', tenantId: 'tenant-1' })).rejects.toBeInstanceOf(AppointmentNotFoundError);
  });

  it('throws InvalidStatusTransitionError when appointment is COMPLETED', async () => {
    const uc = new CancelAppointmentUseCase(makeRepo(makeAppt('COMPLETED')), MOCK_EMITTER);
    await expect(uc.execute({ id: 'appt-1', tenantId: 'tenant-1' })).rejects.toBeInstanceOf(InvalidStatusTransitionError);
  });
});
