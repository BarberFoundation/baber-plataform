export const REMINDER_QUEUE = 'reminder';

export interface ReminderJobData {
  tenantId:      string;
  appointmentId: string;
  clientName:    string;
  clientPhone:   string;
  date:          string;
  startTime:     string;
}
