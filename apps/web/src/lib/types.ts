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

export interface RevenueByDay { date: string; totalInCents: number; count: number }
export interface RevenueByService { serviceId: string; serviceName: string; totalInCents: number; count: number }
export interface RevenueByBarber { barberId: string; barberName: string; totalInCents: number; count: number }

export interface RevenueReport {
  totalInCents: number;
  appointmentCount: number;
  averageTicketInCents: number;
  byDay: RevenueByDay[];
  byService: RevenueByService[];
  byBarber: RevenueByBarber[];
}

export interface OccupancyByBarber {
  barberId: string;
  barberName: string;
  rate: number;
  scheduledMinutes: number;
  availableMinutes: number;
}

export interface HeatmapCell { weekday: number; hour: number; count: number }

export interface OccupancyReport {
  overallRate: number;
  scheduledMinutes: number;
  availableMinutes: number;
  byBarber: OccupancyByBarber[];
  heatmap: HeatmapCell[];
  cancellation: { cancelled: number; total: number; rate: number };
}

export interface NewReturningByDay { date: string; newCount: number; returningCount: number }
export interface NewReturningCounts {
  newCount: number;
  returningCount: number;
  byDay: NewReturningByDay[];
}

export interface InactiveClient {
  customerId: string;
  name: string | null;
  phone: string | null;
  lastVisitDate: string;
  daysSinceLastVisit: number;
}

export interface AdminProfile {
  id: string;
  name: string | null;
  role: string;
  phone: string | null;
  email: string | null;
}

export interface TenantSettings {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  timezone: string;
  logoUrl: string | null;
  businessHours: Record<DayOfWeek, DaySchedule>;
}
