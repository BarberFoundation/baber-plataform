import { Inject, Injectable } from '@nestjs/common';
import { REPORTING_REPOSITORY, IReportingRepository, NewReturningCounts } from './ports/reporting.repository';

@Injectable()
export class NewReturningClientsService {
  constructor(@Inject(REPORTING_REPOSITORY) private readonly repo: IReportingRepository) {}

  async execute(tenantId: string, from: string, to: string): Promise<NewReturningCounts> {
    return this.repo.newReturningCounts(tenantId, from, to);
  }
}
