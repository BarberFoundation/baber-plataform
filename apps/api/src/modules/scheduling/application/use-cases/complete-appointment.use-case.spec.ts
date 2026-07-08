import { CompleteAppointmentUseCase } from './complete-appointment.use-case';
import { ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';
import { AppointmentNotFoundError, InvalidStatusTransitionError } from '../../domain/errors/scheduling.errors';

function makeAppt(status: Appointment['status'] = 'CONFIRMED') {
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

describe('CompleteAppointmentUseCase', () => {
  it('completes a CONFIRMED appointment', async () => {
    const repo = makeRepo();
    const uc = new CompleteAppointmentUseCase(repo);
    const result = await uc.execute({ id: 'appt-1', tenantId: 'tenant-1' });
    expect(result.status).toBe('COMPLETED');
    expect(repo.save).toHaveBeenCalled();
  });

  it('throws AppointmentNotFoundError when not found', async () => {
    const uc = new CompleteAppointmentUseCase(makeRepo(null));
    await expect(uc.execute({ id: 'x', tenantId: 'tenant-1' })).rejects.toBeInstanceOf(AppointmentNotFoundError);
  });

  it('throws InvalidStatusTransitionError when appointment is not CONFIRMED', async () => {
    const uc = new CompleteAppointmentUseCase(makeRepo(makeAppt('PENDING')));
    await expect(uc.execute({ id: 'appt-1', tenantId: 'tenant-1' })).rejects.toBeInstanceOf(InvalidStatusTransitionError);
  });
});
