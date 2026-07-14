import { WorkSchedule } from '../../../team/domain/value-objects/work-schedule';

export const REPORTING_REPOSITORY = Symbol('IReportingRepository');

export interface RevenueByDay { date: string; totalInCents: number; count: number }
export interface RevenueByService { serviceId: string; serviceName: string; totalInCents: number; count: number }
export interface RevenueByBarber { barberId: string; barberName: string; totalInCents: number; count: number }

export interface RevenueAggregates {
  totalInCents: number;
  appointmentCount: number;
  byDay: RevenueByDay[];
  byService: RevenueByService[];
  byBarber: RevenueByBarber[];
}

export interface HeatmapCell { weekday: number; hour: number; count: number }
export interface ActiveBarberSchedule { id: string; name: string; workSchedule: WorkSchedule }

export interface IReportingRepository {
  revenueAggregates(tenantId: string, from: string, to: string): Promise<RevenueAggregates>;
  scheduledMinutesByBarber(tenantId: string, from: string, to: string): Promise<Array<{ barberId: string; minutes: number }>>;
  activeBarbers(tenantId: string): Promise<ActiveBarberSchedule[]>;
  heatmap(tenantId: string, from: string, to: string): Promise<HeatmapCell[]>;
  cancellationCounts(tenantId: string, from: string, to: string): Promise<{ cancelled: number; total: number }>;
}
