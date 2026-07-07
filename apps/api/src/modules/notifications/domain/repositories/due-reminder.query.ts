export const DUE_REMINDER_QUERY = Symbol('IDueReminderQuery');

export interface DueReminder {
  tenantId:      string;
  appointmentId: string;
  clientName:    string;
  clientPhone:   string;
  date:          string;
  startTime:     string;
}

export interface IDueReminderQuery {
  /** Active appointments whose 24h reminder is due at [now] and not yet logged. */
  findDue(now: Date): Promise<DueReminder[]>;
}
