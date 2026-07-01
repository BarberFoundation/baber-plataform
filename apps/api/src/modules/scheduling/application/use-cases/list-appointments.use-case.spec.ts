import { ListAppointmentsUseCase, ListAppointmentsInput } from './list-appointments.use-case';
import { ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';

function makeAppt(id: string, date: string, barberId: string, status: Appointment['status']) {
  return Appointment.reconstitute({
    id, tenantId: 'tenant-1', barberId, serviceId: 'svc-1',
    clientName: 'João', clientPhone: '+55', date,
    startTime: '09:00', endTime: '09:30', durationMinutes: 30,
    status, notes: null, createdAt: new Date(), updatedAt: new Date(),
  });
}

const APPTS = [
  makeAppt('a1', '2025-03-10', 'barber-1', 'PENDING'),
  makeAppt('a2', '2025-03-10', 'barber-2', 'CONFIRMED'),
  makeAppt('a3', '2025-03-11', 'barber-1', 'COMPLETED'),
];

function makeRepo(appts = APPTS): ISchedulingRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockImplementation(async (_tenantId: string, filter: { date?: string; barberId?: string; status?: string }) => {
      return appts.filter((a) => {
        if (filter.date     && a.date     !== filter.date)     return false;
        if (filter.barberId && a.barberId !== filter.barberId) return false;
        if (filter.status   && a.status   !== filter.status)   return false;
        return true;
      });
    }),
    findByBarberAndDate: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
  };
}

describe('ListAppointmentsUseCase', () => {
  it('returns all appointments for tenant when no filter applied', async () => {
    const uc = new ListAppointmentsUseCase(makeRepo());
    const result = await uc.execute({ tenantId: 'tenant-1' });
    expect(result).toHaveLength(3);
  });

  it('filters by date', async () => {
    const uc = new ListAppointmentsUseCase(makeRepo());
    const result = await uc.execute({ tenantId: 'tenant-1', date: '2025-03-10' });
    expect(result).toHaveLength(2);
    expect(result.every((a) => a.date === '2025-03-10')).toBe(true);
  });

  it('filters by barberId', async () => {
    const uc = new ListAppointmentsUseCase(makeRepo());
    const result = await uc.execute({ tenantId: 'tenant-1', barberId: 'barber-1' });
    expect(result).toHaveLength(2);
    expect(result.every((a) => a.barberId === 'barber-1')).toBe(true);
  });

  it('filters by status', async () => {
    const uc = new ListAppointmentsUseCase(makeRepo());
    const result = await uc.execute({ tenantId: 'tenant-1', status: 'CONFIRMED' });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('CONFIRMED');
  });

  it('returns empty array when no appointments match', async () => {
    const uc = new ListAppointmentsUseCase(makeRepo());
    const result = await uc.execute({ tenantId: 'tenant-1', date: '2099-01-01' });
    expect(result).toEqual([]);
  });
});
