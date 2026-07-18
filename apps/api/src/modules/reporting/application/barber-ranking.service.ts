import { Injectable } from '@nestjs/common';
import { RevenueReportService } from './revenue-report.service';
import { OccupancyReportService } from './occupancy-report.service';

export interface BarberRankingEntry {
  barberId: string;
  barberName: string;
  totalInCents: number;
  appointmentCount: number;
  averageTicketInCents: number;
  occupancyRate: number;
}

@Injectable()
export class BarberRankingService {
  constructor(
    private readonly revenueReport: RevenueReportService,
    private readonly occupancyReport: OccupancyReportService,
  ) {}

  async execute(tenantId: string, from: string, to: string): Promise<BarberRankingEntry[]> {
    const [revenue, occupancy] = await Promise.all([
      this.revenueReport.execute(tenantId, from, to),
      this.occupancyReport.execute(tenantId, from, to),
    ]);
    const revenueByBarberId = new Map(revenue.byBarber.map((b) => [b.barberId, b]));

    return occupancy.byBarber.map((o) => {
      const rev = revenueByBarberId.get(o.barberId);
      const totalInCents = rev?.totalInCents ?? 0;
      const appointmentCount = rev?.count ?? 0;
      return {
        barberId: o.barberId,
        barberName: o.barberName,
        totalInCents,
        appointmentCount,
        averageTicketInCents: appointmentCount === 0 ? 0 : Math.round(totalInCents / appointmentCount),
        occupancyRate: o.rate,
      };
    });
  }
}
