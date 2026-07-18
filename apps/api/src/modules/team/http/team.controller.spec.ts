import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { TeamController } from './team.controller';
import { AddBarberUseCase } from '../application/use-cases/add-barber.use-case';
import { UpdateBarberUseCase } from '../application/use-cases/update-barber.use-case';
import { SetWorkScheduleUseCase } from '../application/use-cases/set-work-schedule.use-case';
import { GetBarberUseCase } from '../application/use-cases/get-barber.use-case';
import { ListBarbersUseCase } from '../application/use-cases/list-barbers.use-case';
import { DeactivateBarberUseCase } from '../application/use-cases/deactivate-barber.use-case';
import { Barber } from '../domain/entities/barber.entity';
import { defaultWorkSchedule } from '@shared/kernel/value-objects/work-schedule';

const TENANT_ID = '123e4567-e89b-42d3-a456-426614174000';
const BARBER_ID = '223e4567-e89b-42d3-a456-426614174000';

const barberFixture = Barber.reconstitute({
  id: BARBER_ID,
  tenantId: 't1',
  name: 'João',
  phone: '+5511999999999',
  isActive: true,
  workSchedule: defaultWorkSchedule(),
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
});

describe('TeamController (http)', () => {
  let app: INestApplication;
  const addBarber = { execute: jest.fn().mockResolvedValue(barberFixture) };
  const updateBarber = { execute: jest.fn().mockResolvedValue(barberFixture) };
  const setWorkSchedule = { execute: jest.fn().mockResolvedValue(barberFixture) };
  const getBarber = { execute: jest.fn().mockResolvedValue(barberFixture) };
  const listBarbers = { execute: jest.fn().mockResolvedValue([barberFixture]) };
  const deactivateBarber = { execute: jest.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TeamController],
      providers: [
        { provide: AddBarberUseCase, useValue: addBarber },
        { provide: UpdateBarberUseCase, useValue: updateBarber },
        { provide: SetWorkScheduleUseCase, useValue: setWorkSchedule },
        { provide: GetBarberUseCase, useValue: getBarber },
        { provide: ListBarbersUseCase, useValue: listBarbers },
        { provide: DeactivateBarberUseCase, useValue: deactivateBarber },
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

  it('200 on the @Public barber list with a valid x-tenant-id', async () => {
    await request(app.getHttpServer()).get('/barbers').set('x-tenant-id', TENANT_ID).expect(200);
  });

  it('400 on the @Public barber list with a missing x-tenant-id', async () => {
    await request(app.getHttpServer()).get('/barbers').expect(400);
  });

  it('400 on the @Public barber list with a malformed x-tenant-id', async () => {
    await request(app.getHttpServer()).get('/barbers').set('x-tenant-id', 'not-a-uuid').expect(400);
  });

  it('200 on GET /barbers/admin', async () => {
    await request(app.getHttpServer()).get('/barbers/admin').expect(200);
    expect(listBarbers.execute).toHaveBeenCalledWith({ tenantId: 't1', includeInactive: false });
  });

  it('passes includeInactive=true through to the use-case', async () => {
    await request(app.getHttpServer()).get('/barbers/admin').query({ includeInactive: 'true' }).expect(200);
    expect(listBarbers.execute).toHaveBeenCalledWith({ tenantId: 't1', includeInactive: true });
  });

  it('201 when creating a barber with a valid name', async () => {
    await request(app.getHttpServer()).post('/barbers').send({ name: 'Novo Barbeiro' }).expect(201);
  });

  it('400 when creating a barber without a name', async () => {
    await request(app.getHttpServer()).post('/barbers').send({}).expect(400);
  });

  it('400 when updateWorkSchedule gets a malformed day entry', async () => {
    const malformed = { ...defaultWorkSchedule(), mon: { isWorking: true, startTime: 'not-a-time', endTime: '18:00' } };
    await request(app.getHttpServer())
      .put(`/barbers/${BARBER_ID}/work-schedule`)
      .send({ workSchedule: malformed })
      .expect(400);
  });

  it('204 when deactivating a barber', async () => {
    await request(app.getHttpServer()).patch(`/barbers/${BARBER_ID}/deactivate`).expect(204);
    expect(deactivateBarber.execute).toHaveBeenCalledWith({ id: BARBER_ID, tenantId: 't1' });
  });

  it('400 when :id is not a UUID', async () => {
    await request(app.getHttpServer()).patch('/barbers/not-a-uuid/deactivate').expect(400);
  });
});
