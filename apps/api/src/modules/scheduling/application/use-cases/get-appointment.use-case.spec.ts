import { GetAppointmentUseCase } from './get-appointment.use-case';
import { ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';
import { AppointmentNotFoundError } from '../../domain/errors/scheduling.errors';

const EXISTING = Appointment.reconstitute({
  id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
  clientName: 'João', clientPhone: '+55', date: '2025-03-10',
  startTime: '09:00', endTime: '09:30', durationMinutes: 30,
  status: 'PENDING', notes: null, createdAt: new Date(), updatedAt: new Date(),
});

function makeRepo(appt: Appointment | null = EXISTING): ISchedulingRepository {
  return {
    findById: jest.fn().mockResolvedValue(appt),
    findAll: jest.fn().mockResolvedValue([]),
    findByBarberAndDate: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
  };
}

describe('GetAppointmentUseCase', () => {
  it('returns the appointment when it exists', async () => {
    const uc = new GetAppointmentUseCase(makeRepo());
    const result = await uc.execute({ id: 'appt-1', tenantId: 'tenant-1' });
    expect(result.id).toBe('appt-1');
    expect(result.clientName).toBe('João');
  });

  it('throws AppointmentNotFoundError when not found', async () => {
    const uc = new GetAppointmentUseCase(makeRepo(null));
    await expect(uc.execute({ id: 'x', tenantId: 'tenant-1' })).rejects.toBeInstanceOf(AppointmentNotFoundError);
  });
});
