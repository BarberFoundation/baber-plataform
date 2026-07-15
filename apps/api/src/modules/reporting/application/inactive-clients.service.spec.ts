import { InactiveClientsService } from './inactive-clients.service';
import { IReportingRepository, InactiveClient } from './ports/reporting.repository';

function makeRepo(clients: InactiveClient[]): IReportingRepository {
  return {
    revenueAggregates: jest.fn(),
    scheduledMinutesByBarber: jest.fn(),
    activeBarbers: jest.fn(),
    heatmap: jest.fn(),
    cancellationCounts: jest.fn(),
    newReturningCounts: jest.fn(),
    inactiveClients: jest.fn().mockResolvedValue(clients),
  };
}

describe('InactiveClientsService', () => {
  afterEach(() => jest.useRealTimers());

  it('computes daysSinceLastVisit from lastVisitDate', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-15T12:00:00Z'));

    const repo = makeRepo([
      { customerId: 'c1', name: 'Maria', phone: '+5511999999999', lastVisitDate: '2026-04-01' },
    ]);
    const service = new InactiveClientsService(repo);

    const result = await service.execute('t1', 60);

    expect(repo.inactiveClients).toHaveBeenCalledWith('t1', 60);
    expect(result[0].daysSinceLastVisit).toBe(105);
    expect(result[0].name).toBe('Maria');
  });
});
