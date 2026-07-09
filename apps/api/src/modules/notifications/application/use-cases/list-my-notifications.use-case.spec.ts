import { ListMyNotificationsUseCase } from './list-my-notifications.use-case';
import { INotificationRepository } from '../../domain/repositories/notification.repository';
import { NotificationLog } from '../../domain/entities/notification-log.entity';

describe('ListMyNotificationsUseCase', () => {
  it('delegates to repo.findByCustomer', async () => {
    const log = NotificationLog.reconstitute({
      id: 'log-1', tenantId: 'tenant-1', appointmentId: 'appt-1', type: 'CONFIRMATION',
      phone: '+55', message: 'Confirmado!', status: 'SENT', sentAt: new Date(), error: null, createdAt: new Date(),
    });
    const repo: INotificationRepository = {
      save: jest.fn(),
      findByCustomer: jest.fn().mockResolvedValue([log]),
    };
    const uc = new ListMyNotificationsUseCase(repo);
    const result = await uc.execute({ tenantId: 'tenant-1', customerId: 'user-1' });
    expect(repo.findByCustomer).toHaveBeenCalledWith('user-1', 'tenant-1');
    expect(result).toEqual([log]);
  });
});
