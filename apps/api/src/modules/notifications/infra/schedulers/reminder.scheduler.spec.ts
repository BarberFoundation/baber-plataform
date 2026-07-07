import { ReminderScheduler } from './reminder.scheduler';
import { IDueReminderQuery, DueReminder } from '../../domain/repositories/due-reminder.query';
import { SendReminderNotificationUseCase } from '../../application/use-cases/send-reminder-notification.use-case';

const DUE: DueReminder[] = [
  {
    tenantId:      'tenant-1',
    appointmentId: 'appt-1',
    clientName:    'João',
    clientPhone:   '+5511999999999',
    date:          '2025-03-11',
    startTime:     '09:00',
  },
  {
    tenantId:      'tenant-1',
    appointmentId: 'appt-2',
    clientName:    'Maria',
    clientPhone:   '+5511888888888',
    date:          '2025-03-11',
    startTime:     '10:00',
  },
];

function makeQuery(due: DueReminder[]): IDueReminderQuery {
  return { findDue: jest.fn().mockResolvedValue(due) };
}

function makeSendReminder(): SendReminderNotificationUseCase {
  return { execute: jest.fn().mockResolvedValue(undefined) } as unknown as SendReminderNotificationUseCase;
}

describe('ReminderScheduler', () => {
  it('sends a reminder for each due appointment', async () => {
    const query        = makeQuery(DUE);
    const sendReminder = makeSendReminder();
    const scheduler    = new ReminderScheduler(query, sendReminder);

    await scheduler.tick();

    expect(query.findDue).toHaveBeenCalledWith(expect.any(Date));
    expect(sendReminder.execute).toHaveBeenCalledTimes(2);
    expect(sendReminder.execute).toHaveBeenCalledWith(DUE[0]);
    expect(sendReminder.execute).toHaveBeenCalledWith(DUE[1]);
  });

  it('does nothing when no reminders are due', async () => {
    const query        = makeQuery([]);
    const sendReminder = makeSendReminder();
    const scheduler    = new ReminderScheduler(query, sendReminder);

    await scheduler.tick();

    expect(sendReminder.execute).not.toHaveBeenCalled();
  });
});
