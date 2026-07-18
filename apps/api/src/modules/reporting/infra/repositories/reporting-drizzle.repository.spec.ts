import { ReportingDrizzleRepository } from './reporting-drizzle.repository';
import { WorkSchedule } from '@shared/kernel/value-objects/work-schedule';

function makeChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = jest.fn(self);
  chain.from = jest.fn(self);
  chain.innerJoin = jest.fn(self);
  chain.where = jest.fn(self);
  chain.groupBy = jest.fn(self);
  chain.orderBy = jest.fn(self);
  chain.as = jest.fn(self);
  chain.then = (resolve: (v: unknown) => void) => resolve(result);
  return chain;
}

const mondayOnly: WorkSchedule = {
  mon: { isWorking: true, startTime: '09:00', endTime: '18:00' },
  tue: { isWorking: false, startTime: null, endTime: null },
  wed: { isWorking: false, startTime: null, endTime: null },
  thu: { isWorking: false, startTime: null, endTime: null },
  fri: { isWorking: false, startTime: null, endTime: null },
  sat: { isWorking: false, startTime: null, endTime: null },
  sun: { isWorking: false, startTime: null, endTime: null },
};

describe('ReportingDrizzleRepository', () => {
  describe('revenueAggregates', () => {
    it('combines totals, byDay, byService and byBarber from 4 sequential queries', async () => {
      const select = jest
        .fn()
        .mockImplementationOnce(() => makeChain([{ totalInCents: 12000, appointmentCount: 3 }]))
        .mockImplementationOnce(() => makeChain([{ date: '2026-07-01', totalInCents: 12000, count: 3 }]))
        .mockImplementationOnce(() => makeChain([{ serviceId: 's1', serviceName: 'Corte', totalInCents: 12000, count: 3 }]))
        .mockImplementationOnce(() => makeChain([{ barberId: 'b1', barberName: 'João', totalInCents: 12000, count: 3 }]));
      const repo = new ReportingDrizzleRepository({ select } as never);

      const result = await repo.revenueAggregates('t1', '2026-07-01', '2026-07-31');

      expect(result).toEqual({
        totalInCents: 12000,
        appointmentCount: 3,
        byDay: [{ date: '2026-07-01', totalInCents: 12000, count: 3 }],
        byService: [{ serviceId: 's1', serviceName: 'Corte', totalInCents: 12000, count: 3 }],
        byBarber: [{ barberId: 'b1', barberName: 'João', totalInCents: 12000, count: 3 }],
      });
    });

    it('defaults totals to 0 when the tenant has no completed appointments', async () => {
      const select = jest
        .fn()
        .mockImplementationOnce(() => makeChain([]))
        .mockImplementationOnce(() => makeChain([]))
        .mockImplementationOnce(() => makeChain([]))
        .mockImplementationOnce(() => makeChain([]));
      const repo = new ReportingDrizzleRepository({ select } as never);

      const result = await repo.revenueAggregates('t1', '2026-07-01', '2026-07-31');

      expect(result.totalInCents).toBe(0);
      expect(result.appointmentCount).toBe(0);
    });
  });

  describe('activeBarbers', () => {
    it('maps rows into ActiveBarberSchedule, casting the stored workSchedule', async () => {
      const select = jest.fn(() => makeChain([{ id: 'b1', name: 'João', workSchedule: mondayOnly }]));
      const repo = new ReportingDrizzleRepository({ select } as never);

      const barbers = await repo.activeBarbers('t1');

      expect(barbers).toEqual([{ id: 'b1', name: 'João', workSchedule: mondayOnly }]);
    });
  });

  describe('scheduledMinutesByBarber', () => {
    it('passes through the aggregated minutes per barber', async () => {
      const select = jest.fn(() => makeChain([{ barberId: 'b1', minutes: 270 }]));
      const repo = new ReportingDrizzleRepository({ select } as never);

      const result = await repo.scheduledMinutesByBarber('t1', '2026-07-01', '2026-07-31');

      expect(result).toEqual([{ barberId: 'b1', minutes: 270 }]);
    });
  });

  describe('heatmap', () => {
    it('passes through the weekday/hour/count cells', async () => {
      const select = jest.fn(() => makeChain([{ weekday: 1, hour: 10, count: 4 }]));
      const repo = new ReportingDrizzleRepository({ select } as never);

      const result = await repo.heatmap('t1', '2026-07-01', '2026-07-31');

      expect(result).toEqual([{ weekday: 1, hour: 10, count: 4 }]);
    });
  });

  describe('cancellationCounts', () => {
    it('returns the cancelled/total row when present', async () => {
      const select = jest.fn(() => makeChain([{ cancelled: 2, total: 10 }]));
      const repo = new ReportingDrizzleRepository({ select } as never);

      const result = await repo.cancellationCounts('t1', '2026-07-01', '2026-07-31');

      expect(result).toEqual({ cancelled: 2, total: 10 });
    });

    it('defaults to 0/0 when there is no row', async () => {
      const select = jest.fn(() => makeChain([]));
      const repo = new ReportingDrizzleRepository({ select } as never);

      const result = await repo.cancellationCounts('t1', '2026-07-01', '2026-07-31');

      expect(result).toEqual({ cancelled: 0, total: 0 });
    });
  });

  describe('newReturningCounts', () => {
    it('sums newCount/returningCount across the byDay rows', async () => {
      const select = jest
        .fn()
        .mockImplementationOnce(() => makeChain(makeChain([]))) // firstVisit subquery (.as())
        .mockImplementationOnce(() =>
          makeChain([
            { date: '2026-07-01', newCount: 2, returningCount: 1 },
            { date: '2026-07-02', newCount: 0, returningCount: 3 },
          ]),
        );
      const repo = new ReportingDrizzleRepository({ select } as never);

      const result = await repo.newReturningCounts('t1', '2026-07-01', '2026-07-31');

      expect(result.newCount).toBe(2);
      expect(result.returningCount).toBe(4);
      expect(result.byDay).toHaveLength(2);
    });
  });

  describe('inactiveClients', () => {
    it('maps joined rows, passing through nullable name/phone', async () => {
      const select = jest
        .fn()
        .mockImplementationOnce(() => makeChain(makeChain([]))) // lastVisit subquery (.as())
        .mockImplementationOnce(() =>
          makeChain([{ customerId: 'c1', name: null, phone: '+5511999999999', lastVisitDate: '2026-04-01' }]),
        );
      const repo = new ReportingDrizzleRepository({ select } as never);

      const result = await repo.inactiveClients('t1', 60);

      expect(result).toEqual([
        { customerId: 'c1', name: null, phone: '+5511999999999', lastVisitDate: '2026-04-01' },
      ]);
    });
  });
});
