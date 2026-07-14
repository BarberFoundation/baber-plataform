import { Module } from '@nestjs/common';
import { DatabaseModule } from '@shared/database/database.module';
import { REPORTING_REPOSITORY } from './application/ports/reporting.repository';
import { ReportingDrizzleRepository } from './infra/repositories/reporting-drizzle.repository';
import { RevenueReportService } from './application/revenue-report.service';
import { OccupancyReportService } from './application/occupancy-report.service';
import { ReportingController } from './http/reporting.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [ReportingController],
  providers: [
    { provide: REPORTING_REPOSITORY, useClass: ReportingDrizzleRepository },
    RevenueReportService,
    OccupancyReportService,
  ],
})
export class ReportingModule {}
