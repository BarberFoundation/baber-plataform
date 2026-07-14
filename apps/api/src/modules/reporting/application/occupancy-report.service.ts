import { Inject, Injectable } from '@nestjs/common';
import { REPORTING_REPOSITORY, IReportingRepository, HeatmapCell } from './ports/reporting.repository';
import { availableMinutesForRange } from './work-schedule-minutes';

export interface OccupancyByBarber {
  barberId: string;
  barberName: string;
  rate: number;
  scheduledMinutes: number;
  availableMinutes: number;
}

export interface OccupancyReport {
  overallRate: number;
  scheduledMinutes: number;
  availableMinutes: number;
  byBarber: OccupancyByBarber[];
  heatmap: HeatmapCell[];
  cancellation: { cancelled: number; total: number; rate: number };
}

function ratio(num: number, den: number): number {
  return den === 0 ? 0 : num / den;
}

@Injectable()
export class OccupancyReportService {
  constructor(@Inject(REPORTING_REPOSITORY) private readonly repo: IReportingRepository) {}

  async execute(tenantId: string, from: string, to: string): Promise<OccupancyReport> {
    const [barbers, scheduled, heatmap, cancellation] = await Promise.all([
      this.repo.activeBarbers(tenantId),
      this.repo.scheduledMinutesByBarber(tenantId, from, to),
      this.repo.heatmap(tenantId, from, to),
      this.repo.cancellationCounts(tenantId, from, to),
    ]);

    const scheduledByBarber = new Map(scheduled.map((s) => [s.barberId, s.minutes]));

    // Barbeiro desativado fica fora do numerador E do denominador (sem
    // histórico de ativação — simplificação registrada no spec).
    const byBarber: OccupancyByBarber[] = barbers.map((b) => {
      const availableMinutes = availableMinutesForRange(b.workSchedule, from, to);
      const scheduledMinutes = scheduledByBarber.get(b.id) ?? 0;
      return {
        barberId: b.id,
        barberName: b.name,
        rate: ratio(scheduledMinutes, availableMinutes),
        scheduledMinutes,
        availableMinutes,
      };
    });

    const totalScheduled = byBarber.reduce((acc, b) => acc + b.scheduledMinutes, 0);
    const totalAvailable = byBarber.reduce((acc, b) => acc + b.availableMinutes, 0);

    return {
      overallRate: ratio(totalScheduled, totalAvailable),
      scheduledMinutes: totalScheduled,
      availableMinutes: totalAvailable,
      byBarber,
      heatmap,
      cancellation: { ...cancellation, rate: ratio(cancellation.cancelled, cancellation.total) },
    };
  }
}
