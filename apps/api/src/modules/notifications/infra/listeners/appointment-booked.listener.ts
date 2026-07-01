import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '@shared/events/appointment-events';
import { SendConfirmationNotificationUseCase } from '../../application/use-cases/send-confirmation-notification.use-case';
import { REMINDER_QUEUE, ReminderJobData } from '../queues/reminder.queue';

@Injectable()
export class AppointmentBookedListener {
  constructor(
    private readonly sendConfirmation: SendConfirmationNotificationUseCase,
    @InjectQueue(REMINDER_QUEUE) private readonly reminderQueue: Queue<ReminderJobData>,
  ) {}

  @OnEvent(APPOINTMENT_EVENTS.BOOKED)
  async handle(payload: AppointmentEventPayload): Promise<void> {
    await this.sendConfirmation.execute({
      tenantId:      payload.tenantId,
      appointmentId: payload.appointmentId,
      clientName:    payload.clientName,
      clientPhone:   payload.clientPhone,
      date:          payload.date,
      startTime:     payload.startTime,
    });

    const appointmentMs = new Date(`${payload.date}T${payload.startTime}:00`).getTime();
    const reminderMs    = appointmentMs - 24 * 60 * 60 * 1000;
    const delayMs       = reminderMs - Date.now();

    if (delayMs > 2 * 60 * 60 * 1000) {
      const jobData: ReminderJobData = {
        tenantId:      payload.tenantId,
        appointmentId: payload.appointmentId,
        clientName:    payload.clientName,
        clientPhone:   payload.clientPhone,
        date:          payload.date,
        startTime:     payload.startTime,
      };
      await this.reminderQueue.add('send-reminder', jobData, { delay: delayMs });
    }
  }
}
