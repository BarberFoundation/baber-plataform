import { CompleteAppointmentUseCase } from './complete-appointment.use-case';
import { ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';
import { AppointmentNotFoundError, InvalidStatusTransitionError } from '../../domain/errors/scheduling.errors';

function makeAppt(status: Appointment['status'] = 'CONFIRMED') {
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

function makeEmitter() {
  return {
    emit: jest.fn(),
  };
}

describe('CompleteAppointmentUseCase', () => {
  it('completes a CONFIRMED appointment', async () => {
    const repo = makeRepo();
    const emitter = makeEmitter();
    const uc = new CompleteAppointmentUseCase(repo, emitter as never);
    const result = await uc.execute({ id: 'appt-1', tenantId: 'tenant-1' });
    expect(result.status).toBe('COMPLETED');
    expect(repo.save).toHaveBeenCalled();
  });

  it('throws AppointmentNotFoundError when not found', async () => {
    const repo = makeRepo(null);
    const emitter = makeEmitter();
    const uc = new CompleteAppointmentUseCase(repo, emitter as never);
    await expect(uc.execute({ id: 'x', tenantId: 'tenant-1' })).rejects.toBeInstanceOf(AppointmentNotFoundError);
  });

  it('throws InvalidStatusTransitionError when appointment is not CONFIRMED', async () => {
    const repo = makeRepo(makeAppt('PENDING'));
    const emitter = makeEmitter();
    const uc = new CompleteAppointmentUseCase(repo, emitter as never);
    await expect(uc.execute({ id: 'appt-1', tenantId: 'tenant-1' })).rejects.toBeInstanceOf(InvalidStatusTransitionError);
  });

  it('emits appointment.completed with the appointment data', async () => {
    const repo = makeRepo();
    const emitter = makeEmitter();
    const uc = new CompleteAppointmentUseCase(repo, emitter as never);

    await uc.execute({ id: 'appt-1', tenantId: 'tenant-1' });

    expect(emitter.emit).toHaveBeenCalledWith(
      'appointment.completed',
      expect.objectContaining({ appointmentId: 'appt-1', tenantId: 'tenant-1' }),
    );
  });
});
