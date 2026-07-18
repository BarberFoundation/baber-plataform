import { BarberRankingService } from './barber-ranking.service';
import { RevenueReportService } from './revenue-report.service';
import { OccupancyReportService } from './occupancy-report.service';

function makeRevenueReport(executeImpl?: jest.Mock): RevenueReportService {
  return {
    execute:
      executeImpl ??
      jest.fn().mockResolvedValue({
        totalInCents: 0,
        appointmentCount: 0,
        averageTicketInCents: 0,
        byDay: [],
        byService: [],
        byBarber: [],
      }),
  } as unknown as RevenueReportService;
}

function makeOccupancyReport(executeImpl?: jest.Mock): OccupancyReportService {
  return {
    execute:
      executeImpl ??
      jest.fn().mockResolvedValue({
        overallRate: 0,
        scheduledMinutes: 0,
        availableMinutes: 0,
        byBarber: [],
        heatmap: [],
        cancellation: { cancelled: 0, total: 0, rate: 0 },
      }),
  } as unknown as OccupancyReportService;
}

describe('BarberRankingService', () => {
  it('merges revenue and occupancy data by barberId', async () => {
    const revenue = makeRevenueReport(
      jest.fn().mockResolvedValue({
        totalInCents: 70000,
        appointmentCount: 25,
        averageTicketInCents: 2800,
        byDay: [],
        byService: [],
        byBarber: [{ barberId: 'b1', barberName: 'João', totalInCents: 70000, count: 25 }],
      }),
    );
    const occupancy = makeOccupancyReport(
      jest.fn().mockResolvedValue({
        overallRate: 0.5,
        scheduledMinutes: 270,
        availableMinutes: 540,
        byBarber: [{ barberId: 'b1', barberName: 'João', rate: 0.5, scheduledMinutes: 270, availableMinutes: 540 }],
        heatmap: [],
        cancellation: { cancelled: 0, total: 0, rate: 0 },
      }),
    );
    const service = new BarberRankingService(revenue, occupancy);

    const result = await service.execute('t1', '2026-07-01', '2026-07-31');

    expect(result).toEqual([
      {
        barberId: 'b1',
        barberName: 'João',
        totalInCents: 70000,
        appointmentCount: 25,
        averageTicketInCents: 2800,
        occupancyRate: 0.5,
      },
    ]);
  });

  it('includes active barbers with zero revenue (occupancy list is the base)', async () => {
    const revenue = makeRevenueReport(); // byBarber: []
    const occupancy = makeOccupancyReport(
      jest.fn().mockResolvedValue({
        overallRate: 0,
        scheduledMinutes: 0,
        availableMinutes: 540,
        byBarber: [{ barberId: 'b2', barberName: 'Maria', rate: 0, scheduledMinutes: 0, availableMinutes: 540 }],
        heatmap: [],
        cancellation: { cancelled: 0, total: 0, rate: 0 },
      }),
    );
    const service = new BarberRankingService(revenue, occupancy);

    const result = await service.execute('t1', '2026-07-01', '2026-07-31');

    expect(result).toEqual([
      {
        barberId: 'b2',
        barberName: 'Maria',
        totalInCents: 0,
        appointmentCount: 0,
        averageTicketInCents: 0,
        occupancyRate: 0,
      },
    ]);
  });

  it('rounds average ticket', async () => {
    const revenue = makeRevenueReport(
      jest.fn().mockResolvedValue({
        totalInCents: 10000,
        appointmentCount: 3,
        averageTicketInCents: 3333,
        byDay: [],
        byService: [],
        byBarber: [{ barberId: 'b1', barberName: 'João', totalInCents: 10000, count: 3 }],
      }),
    );
    const occupancy = makeOccupancyReport(
      jest.fn().mockResolvedValue({
        overallRate: 0,
        scheduledMinutes: 0,
        availableMinutes: 0,
        byBarber: [{ barberId: 'b1', barberName: 'João', rate: 0, scheduledMinutes: 0, availableMinutes: 0 }],
        heatmap: [],
        cancellation: { cancelled: 0, total: 0, rate: 0 },
      }),
    );
    const service = new BarberRankingService(revenue, occupancy);

    const result = await service.execute('t1', '2026-07-01', '2026-07-31');

    expect(result[0].averageTicketInCents).toBe(3333); // 10000/3 = 3333.33 → arredonda pra baixo
  });

  it('excludes a barber that has revenue but is no longer active (occupancy list is authoritative)', async () => {
    const revenue = makeRevenueReport(
      jest.fn().mockResolvedValue({
        totalInCents: 50000,
        appointmentCount: 20,
        averageTicketInCents: 2500,
        byDay: [],
        byService: [],
        byBarber: [{ barberId: 'b-deactivated', barberName: 'Ex-barbeiro', totalInCents: 50000, count: 20 }],
      }),
    );
    const occupancy = makeOccupancyReport(); // byBarber: [] — barbeiro não está mais ativo
    const service = new BarberRankingService(revenue, occupancy);

    const result = await service.execute('t1', '2026-07-01', '2026-07-31');

    expect(result).toEqual([]);
  });

  it('returns empty array when tenant has no active barbers', async () => {
    const service = new BarberRankingService(makeRevenueReport(), makeOccupancyReport());
    const result = await service.execute('t1', '2026-07-01', '2026-07-31');
    expect(result).toEqual([]);
  });

  it('calls both services with the same tenantId/from/to', async () => {
    const revenue = makeRevenueReport();
    const occupancy = makeOccupancyReport();
    const service = new BarberRankingService(revenue, occupancy);

    await service.execute('t1', '2026-07-01', '2026-07-31');

    expect(revenue.execute).toHaveBeenCalledWith('t1', '2026-07-01', '2026-07-31');
    expect(occupancy.execute).toHaveBeenCalledWith('t1', '2026-07-01', '2026-07-31');
  });
});
