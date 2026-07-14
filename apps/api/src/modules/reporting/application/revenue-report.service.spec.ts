import { RevenueReportService } from './revenue-report.service';
import { IReportingRepository, RevenueAggregates } from './ports/reporting.repository';

function makeRepo(aggregates: RevenueAggregates): IReportingRepository {
  return {
    revenueAggregates: jest.fn().mockResolvedValue(aggregates),
    scheduledMinutesByBarber: jest.fn(),
    activeBarbers: jest.fn(),
    heatmap: jest.fn(),
    cancellationCounts: jest.fn(),
  };
}

describe('RevenueReportService', () => {
  it('computes average ticket from total and count', async () => {
    const service = new RevenueReportService(makeRepo({
      totalInCents: 10000, appointmentCount: 4, byDay: [], byService: [], byBarber: [],
    }));
    const report = await service.execute('t1', '2026-07-01', '2026-07-31');
    expect(report.averageTicketInCents).toBe(2500);
    expect(report.totalInCents).toBe(10000);
  });

  it('returns zero average ticket when there are no appointments', async () => {
    const service = new RevenueReportService(makeRepo({
      totalInCents: 0, appointmentCount: 0, byDay: [], byService: [], byBarber: [],
    }));
    const report = await service.execute('t1', '2026-07-01', '2026-07-31');
    expect(report.averageTicketInCents).toBe(0);
  });
});
