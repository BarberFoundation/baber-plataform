export const APPOINTMENT_EVENTS = {
  BOOKED:    'appointment.booked',
  CONFIRMED: 'appointment.confirmed',
  CANCELLED: 'appointment.cancelled',
} as const;

export interface AppointmentEventPayload {
  appointmentId: string;
  tenantId:      string;
  clientName:    string;
  clientPhone:   string;
  barberId:      string;
  serviceId:     string;
  date:          string;
  startTime:     string;
  endTime:       string;
}
