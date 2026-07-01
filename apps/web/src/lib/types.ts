export interface User {
  userId: string;
  tenantId: string;
  role: string;
}

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DaySchedule {
  isWorking: boolean;
  startTime: string | null;
  endTime: string | null;
}

export interface Barber {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  workSchedule: Record<DayOfWeek, DaySchedule>;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  priceInCents: number;
  durationMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export interface Appointment {
  id: string;
  tenantId: string;
  barberId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: AppointmentStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
