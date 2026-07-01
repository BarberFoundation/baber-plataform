import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { REMINDER_QUEUE, ReminderJobData } from '../queues/reminder.queue';
import { SendReminderNotificationUseCase } from '../../application/use-cases/send-reminder-notification.use-case';

@Processor(REMINDER_QUEUE)
export class ReminderProcessor extends WorkerHost {
  constructor(private readonly sendReminder: SendReminderNotificationUseCase) {
    super();
  }

  async process(job: Job<ReminderJobData>): Promise<void> {
    await this.sendReminder.execute(job.data);
  }
}
