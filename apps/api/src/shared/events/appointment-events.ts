export const APPOINTMENT_EVENTS = {
  BOOKED:    'appointment.booked',
  CONFIRMED: 'appointment.confirmed',
  CANCELLED: 'appointment.cancelled',
  COMPLETED: 'appointment.completed',
} as const;

export interface AppointmentEventPayload {
  appointmentId: string;
  tenantId:      string;
  customerId:    string | null;
  clientName:    string;
  clientPhone:   string;
  barberId:      string;
  serviceId:     string;
  date:          string;
  startTime:     string;
  endTime:       string;
}
