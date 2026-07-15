import { OccupancyReportService } from './occupancy-report.service';
import { IReportingRepository } from './ports/reporting.repository';
import { WorkSchedule } from '../../team/domain/value-objects/work-schedule';

// jornada só na segunda, 09:00–18:00 (540 min/semana)
const mondayOnly: WorkSchedule = {
  mon: { isWorking: true, startTime: '09:00', endTime: '18:00' },
  tue: { isWorking: false, startTime: null, endTime: null },
  wed: { isWorking: false, startTime: null, endTime: null },
  thu: { isWorking: false, startTime: null, endTime: null },
  fri: { isWorking: false, startTime: null, endTime: null },
  sat: { isWorking: false, startTime: null, endTime: null },
  sun: { isWorking: false, startTime: null, endTime: null },
};

function makeRepo(overrides: Partial<IReportingRepository> = {}): IReportingRepository {
  return {
    revenueAggregates: jest.fn(),
    scheduledMinutesByBarber: jest.fn().mockResolvedValue([{ barberId: 'b1', minutes: 270 }]),
    activeBarbers: jest.fn().mockResolvedValue([{ id: 'b1', name: 'João', workSchedule: mondayOnly }]),
    heatmap: jest.fn().mockResolvedValue([{ weekday: 1, hour: 10, count: 3 }]),
    cancellationCounts: jest.fn().mockResolvedValue({ cancelled: 2, total: 10 }),
    newReturningCounts: jest.fn(),
    inactiveClients: jest.fn(),
    ...overrides,
  };
}

describe('OccupancyReportService', () => {
  // 2026-07-13..2026-07-19 contém exatamente uma segunda → 540 min disponíveis
  const FROM = '2026-07-13';
  const TO = '2026-07-19';

  it('computes overall and per-barber occupancy', async () => {
    const service = new OccupancyReportService(makeRepo());
    const report = await service.execute('t1', FROM, TO);
    expect(report.availableMinutes).toBe(540);
    expect(report.scheduledMinutes).toBe(270);
    expect(report.overallRate).toBeCloseTo(0.5);
    expect(report.byBarber).toEqual([
      { barberId: 'b1', barberName: 'João', rate: 0.5, scheduledMinutes: 270, availableMinutes: 540 },
    ]);
  });

  it('returns rate 0 when there is no available time (no division by zero)', async () => {
    const service = new OccupancyReportService(makeRepo({
      activeBarbers: jest.fn().mockResolvedValue([]),
      scheduledMinutesByBarber: jest.fn().mockResolvedValue([]),
    }));
    const report = await service.execute('t1', FROM, TO);
    expect(report.overallRate).toBe(0);
    expect(report.byBarber).toEqual([]);
  });

  it('computes cancellation rate with zero-total guard', async () => {
    const service = new OccupancyReportService(makeRepo({
      cancellationCounts: jest.fn().mockResolvedValue({ cancelled: 0, total: 0 }),
    }));
    const report = await service.execute('t1', FROM, TO);
    expect(report.cancellation.rate).toBe(0);
  });

  it('passes heatmap through', async () => {
    const service = new OccupancyReportService(makeRepo());
    const report = await service.execute('t1', FROM, TO);
    expect(report.heatmap).toEqual([{ weekday: 1, hour: 10, count: 3 }]);
  });
});
