import { NewReturningClientsService } from './new-returning-clients.service';
import { IReportingRepository, NewReturningCounts } from './ports/reporting.repository';

function makeRepo(counts: NewReturningCounts): IReportingRepository {
  return {
    revenueAggregates: jest.fn(),
    scheduledMinutesByBarber: jest.fn(),
    activeBarbers: jest.fn(),
    heatmap: jest.fn(),
    cancellationCounts: jest.fn(),
    newReturningCounts: jest.fn().mockResolvedValue(counts),
    inactiveClients: jest.fn(),
  };
}

describe('NewReturningClientsService', () => {
  it('forwards tenant/range to the repository and returns its result', async () => {
    const repo = makeRepo({
      newCount: 12,
      returningCount: 34,
      byDay: [{ date: '2026-07-01', newCount: 2, returningCount: 5 }],
    });
    const service = new NewReturningClientsService(repo);

    const result = await service.execute('t1', '2026-07-01', '2026-07-31');

    expect(repo.newReturningCounts).toHaveBeenCalledWith('t1', '2026-07-01', '2026-07-31');
    expect(result.newCount).toBe(12);
    expect(result.returningCount).toBe(34);
    expect(result.byDay).toHaveLength(1);
  });
});
