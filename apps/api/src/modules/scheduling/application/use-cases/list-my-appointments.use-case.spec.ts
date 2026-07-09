import { ListMyAppointmentsUseCase } from './list-my-appointments.use-case';
import { ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';

function makeAppt(overrides: Partial<Parameters<typeof Appointment.reconstitute>[0]> = {}) {
  return Appointment.reconstitute({
    id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
    customerId: 'user-1', clientName: 'Ana', clientPhone: '+55', date: '2025-03-10',
    startTime: '09:00', endTime: '09:30', durationMinutes: 30,
    status: 'PENDING', notes: null, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  });
}

describe('ListMyAppointmentsUseCase', () => {
  it('delegates to repo.findAll filtering by tenantId and customerId', async () => {
    const appt = makeAppt();
    const repo: ISchedulingRepository = {
      findById: jest.fn(),
      findAll: jest.fn().mockResolvedValue([appt]),
      findByBarberAndDate: jest.fn(),
      save: jest.fn(),
    };
    const uc = new ListMyAppointmentsUseCase(repo);
    const result = await uc.execute({ tenantId: 'tenant-1', customerId: 'user-1' });
    expect(repo.findAll).toHaveBeenCalledWith('tenant-1', { customerId: 'user-1' });
    expect(result).toEqual([appt]);
  });
});
