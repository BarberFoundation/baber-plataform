import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  DUE_REMINDER_QUERY,
  IDueReminderQuery,
} from '../../domain/repositories/due-reminder.query';
import { SendReminderNotificationUseCase } from '../../application/use-cases/send-reminder-notification.use-case';

@Injectable()
export class ReminderScheduler {
  private readonly logger = new Logger(ReminderScheduler.name);

  constructor(
    @Inject(DUE_REMINDER_QUERY) private readonly dueReminders: IDueReminderQuery,
    private readonly sendReminder: SendReminderNotificationUseCase,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async tick(): Promise<void> {
    const due = await this.dueReminders.findDue(new Date());
    if (due.length === 0) return;

    this.logger.log(`Sending ${due.length} appointment reminder(s)`);
    for (const reminder of due) {
      await this.sendReminder.execute(reminder);
    }
  }
}
