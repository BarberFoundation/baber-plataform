import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { ReportingController } from './reporting.controller';
import { RevenueReportService } from '../application/revenue-report.service';
import { OccupancyReportService } from '../application/occupancy-report.service';
import { NewReturningClientsService } from '../application/new-returning-clients.service';
import { InactiveClientsService } from '../application/inactive-clients.service';
import { BarberRankingService } from '../application/barber-ranking.service';

describe('ReportingController (http)', () => {
  let app: INestApplication;
  const revenue = { execute: jest.fn().mockResolvedValue({ totalInCents: 0 }) };
  const occupancy = { execute: jest.fn().mockResolvedValue({ overallRate: 0 }) };
  const newReturning = { execute: jest.fn().mockResolvedValue({ newCount: 0, returningCount: 0, byDay: [] }) };
  const inactive = { execute: jest.fn().mockResolvedValue([]) };
  const barberRanking = { execute: jest.fn().mockResolvedValue([]) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportingController],
      providers: [
        { provide: RevenueReportService, useValue: revenue },
        { provide: OccupancyReportService, useValue: occupancy },
        { provide: NewReturningClientsService, useValue: newReturning },
        { provide: InactiveClientsService, useValue: inactive },
        { provide: BarberRankingService, useValue: barberRanking },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    // Guards são globais no app real e não fazem parte deste módulo de teste;
    // injeta o user que o JwtGuard colocaria no request.
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.user = { sub: 'admin-1', tenantId: 't1', role: 'ADMIN' } as never;
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => jest.clearAllMocks());

  it('400 when from is malformed', async () => {
    await request(app.getHttpServer()).get('/reports/revenue?from=07-01-2026&to=2026-07-31').expect(400);
  });

  it('400 when from > to', async () => {
    await request(app.getHttpServer()).get('/reports/revenue?from=2026-08-01&to=2026-07-01').expect(400);
  });

  it('400 when range exceeds 366 days', async () => {
    await request(app.getHttpServer()).get('/reports/occupancy?from=2024-01-01&to=2026-01-01').expect(400);
  });

  it('200 with valid range', async () => {
    await request(app.getHttpServer()).get('/reports/revenue?from=2026-07-01&to=2026-07-31').expect(200);
  });

  it('200 with valid range on occupancy', async () => {
    await request(app.getHttpServer()).get('/reports/occupancy?from=2026-07-01&to=2026-07-31').expect(200);
  });

  it('200 with valid range on barbers/ranking', async () => {
    await request(app.getHttpServer()).get('/reports/barbers/ranking?from=2026-07-01&to=2026-07-31').expect(200);
  });

  it('200 with valid range on clients/new-returning', async () => {
    await request(app.getHttpServer()).get('/reports/clients/new-returning?from=2026-07-01&to=2026-07-31').expect(200);
  });

  it('400 when clients/new-returning range is malformed', async () => {
    await request(app.getHttpServer()).get('/reports/clients/new-returning?from=07-01-2026&to=2026-07-31').expect(400);
  });

  it('400 when clients/inactive days is not 30/60/90', async () => {
    await request(app.getHttpServer()).get('/reports/clients/inactive?days=45').expect(400);
  });

  it('200 with default days (60) on clients/inactive', async () => {
    await request(app.getHttpServer()).get('/reports/clients/inactive').expect(200);
    expect(inactive.execute).toHaveBeenCalledWith('t1', 60);
  });

  it('200 with explicit valid days on clients/inactive', async () => {
    await request(app.getHttpServer()).get('/reports/clients/inactive?days=90').expect(200);
    expect(inactive.execute).toHaveBeenCalledWith('t1', 90);
  });
});
