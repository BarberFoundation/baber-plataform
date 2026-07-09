import { NotificationDrizzleRepository } from './notification-drizzle.repository';

function makeDb(rows: any[]) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockResolvedValue(rows),
  };
  return chain as any;
}

describe('NotificationDrizzleRepository.findByCustomer', () => {
  it('returns rows shaped as NotificationLog reconstitution props', async () => {
    const rows = [{
      id: 'log-1', tenantId: 'tenant-1', appointmentId: 'appt-1', type: 'CONFIRMATION',
      phone: '+5511999999999', message: 'Confirmado!', status: 'SENT',
      sentAt: new Date('2026-01-01'), error: null, createdAt: new Date('2026-01-01'),
    }];
    const db = makeDb(rows);
    const repo = new NotificationDrizzleRepository(db);
    const result = await repo.findByCustomer('user-1', 'tenant-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('log-1');
    expect(result[0].status).toBe('SENT');
  });
});
