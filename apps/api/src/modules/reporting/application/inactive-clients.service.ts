import { Inject, Injectable } from '@nestjs/common';
import { REPORTING_REPOSITORY, IReportingRepository, InactiveClient } from './ports/reporting.repository';

export interface InactiveClientView extends InactiveClient {
  daysSinceLastVisit: number;
}

@Injectable()
export class InactiveClientsService {
  constructor(@Inject(REPORTING_REPOSITORY) private readonly repo: IReportingRepository) {}

  async execute(tenantId: string, days: number): Promise<InactiveClientView[]> {
    const clients = await this.repo.inactiveClients(tenantId, days);
    const now = Date.now();
    return clients.map((c) => ({
      ...c,
      daysSinceLastVisit: Math.floor((now - Date.parse(`${c.lastVisitDate}T00:00:00Z`)) / 86_400_000),
    }));
  }
}
