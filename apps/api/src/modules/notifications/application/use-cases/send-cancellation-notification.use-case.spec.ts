import { SendCancellationNotificationUseCase, SendCancellationInput } from './send-cancellation-notification.use-case';
import { INotificationRepository } from '../../domain/repositories/notification.repository';
import { IWhatsAppGateway } from '../../domain/ports/whatsapp-gateway.port';
import { NotificationLog } from '../../domain/entities/notification-log.entity';

function makeRepo(): INotificationRepository {
  return {
    save: jest.fn().mockImplementation(async (l: NotificationLog) => l),
    findByCustomer: jest.fn().mockResolvedValue([]),
  };
}

function makeGateway(fail = false): IWhatsAppGateway {
  return {
    send: fail
      ? jest.fn().mockRejectedValue(new Error('network error'))
      : jest.fn().mockResolvedValue(undefined),
  };
}

const INPUT: SendCancellationInput = {
  tenantId:      'tenant-1',
  appointmentId: 'appt-1',
  clientName:    'João',
  clientPhone:   '+5511999999999',
  date:          '2025-03-10',
  startTime:     '09:00',
};

describe('SendCancellationNotificationUseCase', () => {
  it('sends WhatsApp cancellation message and saves SENT log', async () => {
    const repo    = makeRepo();
    const gateway = makeGateway();
    const uc      = new SendCancellationNotificationUseCase(repo, gateway);

    await uc.execute(INPUT);

    expect(gateway.send).toHaveBeenCalledWith(
      INPUT.clientPhone,
      expect.stringContaining('cancelado'),
    );
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'SENT' }),
    );
  });

  it('saves FAILED log when gateway throws, does not rethrow', async () => {
    const repo    = makeRepo();
    const gateway = makeGateway(true);
    const uc      = new SendCancellationNotificationUseCase(repo, gateway);

    await expect(uc.execute(INPUT)).resolves.not.toThrow();
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED' }),
    );
  });
});
