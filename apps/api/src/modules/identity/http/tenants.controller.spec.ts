import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { TenantsController } from './tenants.controller';
import { ListTenantsUseCase } from '../application/use-cases/list-tenants.use-case';
import { FindTenantBySlugUseCase } from '../application/use-cases/find-tenant-by-slug.use-case';
import { GetTenantSettingsUseCase } from '../application/use-cases/get-tenant-settings.use-case';
import { UpdateTenantSettingsUseCase } from '../application/use-cases/update-tenant-settings.use-case';

const validBusinessHours = {
  mon: { isWorking: true, startTime: '09:00', endTime: '18:00' },
  tue: { isWorking: true, startTime: '09:00', endTime: '18:00' },
  wed: { isWorking: true, startTime: '09:00', endTime: '18:00' },
  thu: { isWorking: true, startTime: '09:00', endTime: '18:00' },
  fri: { isWorking: true, startTime: '09:00', endTime: '18:00' },
  sat: { isWorking: true, startTime: '09:00', endTime: '13:00' },
  sun: { isWorking: false, startTime: null, endTime: null },
};

describe('TenantsController (http) — PATCH /tenants/me', () => {
  let app: INestApplication;
  const listTenants = { execute: jest.fn().mockResolvedValue([]) };
  const findTenantBySlug = { execute: jest.fn().mockResolvedValue(null) };
  const getTenantSettings = { execute: jest.fn().mockResolvedValue({}) };
  const updateTenantSettings = { execute: jest.fn().mockResolvedValue({}) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        { provide: ListTenantsUseCase, useValue: listTenants },
        { provide: FindTenantBySlugUseCase, useValue: findTenantBySlug },
        { provide: GetTenantSettingsUseCase, useValue: getTenantSettings },
        { provide: UpdateTenantSettingsUseCase, useValue: updateTenantSettings },
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

  it('200 with valid businessHours', async () => {
    await request(app.getHttpServer())
      .patch('/tenants/me')
      .send({ businessHours: validBusinessHours })
      .expect(200);
    expect(updateTenantSettings.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', businessHours: validBusinessHours }),
    );
  });

  it('200 when businessHours is omitted (partial update)', async () => {
    await request(app.getHttpServer()).patch('/tenants/me').send({ name: 'Nova Barbearia' }).expect(200);
  });

  it('400 when a day has isWorking as a non-boolean', async () => {
    const malformed = { ...validBusinessHours, mon: { ...validBusinessHours.mon, isWorking: 'yes' } };
    await request(app.getHttpServer())
      .patch('/tenants/me')
      .send({ businessHours: malformed })
      .expect(400);
  });

  it('400 when startTime is not HH:mm', async () => {
    const malformed = { ...validBusinessHours, mon: { ...validBusinessHours.mon, startTime: '9am' } };
    await request(app.getHttpServer())
      .patch('/tenants/me')
      .send({ businessHours: malformed })
      .expect(400);
  });

  it('400 when isWorking is true but startTime is null', async () => {
    const malformed = { ...validBusinessHours, mon: { isWorking: true, startTime: null, endTime: '18:00' } };
    await request(app.getHttpServer())
      .patch('/tenants/me')
      .send({ businessHours: malformed })
      .expect(400);
  });

  it('400 when businessHours is a string instead of an object', async () => {
    await request(app.getHttpServer())
      .patch('/tenants/me')
      .send({ businessHours: 'segunda a sexta, 9h-18h' })
      .expect(400);
  });
});
