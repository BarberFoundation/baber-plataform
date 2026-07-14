import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { ReportingController } from './reporting.controller';
import { RevenueReportService } from '../application/revenue-report.service';
import { OccupancyReportService } from '../application/occupancy-report.service';

describe('ReportingController (http)', () => {
  let app: INestApplication;
  const revenue = { execute: jest.fn().mockResolvedValue({ totalInCents: 0 }) };
  const occupancy = { execute: jest.fn().mockResolvedValue({ overallRate: 0 }) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportingController],
      providers: [
        { provide: RevenueReportService, useValue: revenue },
        { provide: OccupancyReportService, useValue: occupancy },
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
});
