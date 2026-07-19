import { Test } from '@nestjs/testing';
import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { LoyaltyController } from './loyalty.controller';
import { UpsertStampCardConfigUseCase } from '../application/use-cases/upsert-stamp-card-config.use-case';
import { GetStampCardConfigUseCase } from '../application/use-cases/get-stamp-card-config.use-case';
import { GetMyStampCardUseCase } from '../application/use-cases/get-my-stamp-card.use-case';
import { RedeemCreditUseCase } from '../application/use-cases/redeem-credit.use-case';
import { StampCardConfig } from '../domain/entities/stamp-card-config.entity';

function injectUser(role: 'ADMIN' | 'CLIENT') {
  return (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { userId: 'user-1', tenantId: 't1', role };
    next();
  };
}

describe('LoyaltyController', () => {
  let app: INestApplication;
  const upsertConfig = { execute: jest.fn() };
  const getConfig = { execute: jest.fn() };
  const getMyCard = { execute: jest.fn() };
  const redeemCredit = { execute: jest.fn() };

  async function buildApp(role: 'ADMIN' | 'CLIENT') {
    const moduleRef = await Test.createTestingModule({
      controllers: [LoyaltyController],
      providers: [
        { provide: UpsertStampCardConfigUseCase, useValue: upsertConfig },
        { provide: GetStampCardConfigUseCase, useValue: getConfig },
        { provide: GetMyStampCardUseCase, useValue: getMyCard },
        { provide: RedeemCreditUseCase, useValue: redeemCredit },
      ],
    }).compile();
    const nestApp = moduleRef.createNestApplication();
    nestApp.use(injectUser(role));
    nestApp.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await nestApp.init();
    return nestApp;
  }

  afterEach(async () => {
    jest.clearAllMocks();
    await app?.close();
  });

  it('PUT /loyalty/stamp-card/config upserts and returns the serialized config', async () => {
    app = await buildApp('ADMIN');
    const config = StampCardConfig.create({
      tenantId: 't1',
      eligibleServiceIds: ['svc-1'],
      stampsRequired: 10,
      creditValueInCents: 5000,
      isActive: true,
    });
    upsertConfig.execute.mockResolvedValue(config);

    const res = await request(app.getHttpServer())
      .put('/loyalty/stamp-card/config')
      .send({ eligibleServiceIds: ['svc-1'], stampsRequired: 10, creditValueInCents: 5000, isActive: true });

    expect(res.status).toBe(200);
    expect(res.body.stampsRequired).toBe(10);
    expect(upsertConfig.execute).toHaveBeenCalledWith({
      tenantId: 't1',
      eligibleServiceIds: ['svc-1'],
      stampsRequired: 10,
      creditValueInCents: 5000,
      isActive: true,
    });
  });

  it('GET /loyalty/stamp-card/config returns the serialized config', async () => {
    app = await buildApp('ADMIN');
    const config = StampCardConfig.create({
      tenantId: 't1',
      eligibleServiceIds: ['svc-1'],
      stampsRequired: 10,
      creditValueInCents: 5000,
      isActive: true,
    });
    getConfig.execute.mockResolvedValue(config);

    const res = await request(app.getHttpServer()).get('/loyalty/stamp-card/config');

    expect(res.status).toBe(200);
    expect(res.body.stampsRequired).toBe(10);
    expect(getConfig.execute).toHaveBeenCalledWith({ tenantId: 't1' });
  });

  it('GET /loyalty/stamp-card/me returns the client progress view', async () => {
    app = await buildApp('CLIENT');
    getMyCard.execute.mockResolvedValue({ currentStamps: 3, stampsRequired: 10, creditBalanceInCents: 0 });

    const res = await request(app.getHttpServer()).get('/loyalty/stamp-card/me');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ currentStamps: 3, stampsRequired: 10, creditBalanceInCents: 0 });
    expect(getMyCard.execute).toHaveBeenCalledWith({ tenantId: 't1', clientId: 'user-1' });
  });

  it('POST /loyalty/stamp-card/redeem returns 204 and calls the use case', async () => {
    app = await buildApp('CLIENT');
    redeemCredit.execute.mockResolvedValue(undefined);

    const res = await request(app.getHttpServer())
      .post('/loyalty/stamp-card/redeem')
      .send({ amountInCents: 2000 });

    expect(res.status).toBe(204);
    expect(redeemCredit.execute).toHaveBeenCalledWith({ tenantId: 't1', clientId: 'user-1', amountInCents: 2000 });
  });

  it('rejects a redeem body with a non-positive amountInCents', async () => {
    app = await buildApp('CLIENT');

    const res = await request(app.getHttpServer())
      .post('/loyalty/stamp-card/redeem')
      .send({ amountInCents: 0 });

    expect(res.status).toBe(400);
  });
});
