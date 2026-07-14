import { Inject, Injectable } from '@nestjs/common';
import { REPORTING_REPOSITORY, IReportingRepository, RevenueAggregates } from './ports/reporting.repository';

export interface RevenueReport extends RevenueAggregates {
  averageTicketInCents: number;
}

@Injectable()
export class RevenueReportService {
  constructor(@Inject(REPORTING_REPOSITORY) private readonly repo: IReportingRepository) {}

  async execute(tenantId: string, from: string, to: string): Promise<RevenueReport> {
    const aggregates = await this.repo.revenueAggregates(tenantId, from, to);
    const averageTicketInCents = aggregates.appointmentCount === 0
      ? 0
      : Math.round(aggregates.totalInCents / aggregates.appointmentCount);
    return { ...aggregates, averageTicketInCents };
  }
}
