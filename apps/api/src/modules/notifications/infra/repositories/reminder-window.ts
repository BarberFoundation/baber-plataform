const HOUR_MS = 60 * 60 * 1000;

/** Reminders fire 24h before the appointment starts. */
export const REMINDER_LEAD_MS = 24 * HOUR_MS;
/** Past this window after the due moment a reminder is stale ("amanhã" no longer holds). */
export const REMINDER_GRACE_MS = 4 * HOUR_MS;
/**
 * Appointments booked closer than this to their start never get a reminder —
 * the booking confirmation was just sent (mirrors the old queue rule of only
 * scheduling jobs whose delay exceeded 2h, i.e. bookings made >26h ahead).
 */
export const MIN_BOOKING_LEAD_MS = REMINDER_LEAD_MS + 2 * HOUR_MS;

export interface AppointmentSlot {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
}

export function appointmentStart(slot: AppointmentSlot): Date {
  return new Date(`${slot.date}T${slot.startTime}:00`);
}

export function isReminderDue(slot: AppointmentSlot, createdAt: Date, now: Date): boolean {
  const startMs = appointmentStart(slot).getTime();
  const dueMs = startMs - REMINDER_LEAD_MS;
  const nowMs = now.getTime();

  if (nowMs < dueMs) return false;
  if (nowMs > dueMs + REMINDER_GRACE_MS) return false;
  return createdAt.getTime() <= startMs - MIN_BOOKING_LEAD_MS;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Appointment dates that can hold a due reminder right now: anything whose
 * start falls within [now + lead - grace, now + lead] — at most two calendar days.
 */
export function reminderCandidateDates(now: Date): string[] {
  const from = toDateString(new Date(now.getTime() + REMINDER_LEAD_MS - REMINDER_GRACE_MS));
  const to = toDateString(new Date(now.getTime() + REMINDER_LEAD_MS));
  return from === to ? [from] : [from, to];
}
