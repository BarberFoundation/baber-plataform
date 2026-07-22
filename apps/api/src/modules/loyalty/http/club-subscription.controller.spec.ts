import { Test } from '@nestjs/testing';
import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { RolesGuard } from '@shared/auth/roles.guard';
import { ClubSubscriptionController } from './club-subscription.controller';
import { UpsertSubscriptionTierUseCase } from '../application/use-cases/upsert-subscription-tier.use-case';
import { GetSubscriptionTiersUseCase } from '../application/use-cases/get-subscription-tiers.use-case';
import { ActivateClubSubscriptionUseCase } from '../application/use-cases/activate-club-subscription.use-case';
import { GetMyClubSubscriptionUseCase } from '../application/use-cases/get-my-club-subscription.use-case';
import { CancelClubSubscriptionUseCase } from '../application/use-cases/cancel-club-subscription.use-case';
import { GetAvailableSubscriptionTiersUseCase } from '../application/use-cases/get-available-subscription-tiers.use-case';
import { SubscriptionTier } from '../domain/entities/subscription-tier.entity';
import { ClubSubscription } from '../domain/entities/club-subscription.entity';

function injectUser(role: 'ADMIN' | 'CLIENT') {
  return (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { userId: 'user-1', tenantId: 't1', role };
    next();
  };
}

describe('ClubSubscriptionController', () => {
  let app: INestApplication;
  const upsertTier = { execute: jest.fn() };
  const getTiers = { execute: jest.fn() };
  const activate = { execute: jest.fn() };
  const getMySubscription = { execute: jest.fn() };
  const cancelSubscription = { execute: jest.fn() };
  const getAvailableTiers = { execute: jest.fn() };

  async function buildApp(role: 'ADMIN' | 'CLIENT') {
    const moduleRef = await Test.createTestingModule({
      controllers: [ClubSubscriptionController],
      providers: [
        { provide: UpsertSubscriptionTierUseCase, useValue: upsertTier },
        { provide: GetSubscriptionTiersUseCase, useValue: getTiers },
        { provide: ActivateClubSubscriptionUseCase, useValue: activate },
        { provide: GetMyClubSubscriptionUseCase, useValue: getMySubscription },
        { provide: CancelClubSubscriptionUseCase, useValue: cancelSubscription },
        { provide: GetAvailableSubscriptionTiersUseCase, useValue: getAvailableTiers },
        Reflector,
        { provide: APP_GUARD, useClass: RolesGuard },
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

  it('PUT /loyalty/club-subscription/tiers/:tier upserts as ADMIN', async () => {
    app = await buildApp('ADMIN');
    const tier = SubscriptionTier.create({
      tenantId: 't1',
      tier: 'ESSENCIAL',
      services: [{ serviceId: 'svc-1', quantity: 2 }],
      discountPercentage: 15,
      isActive: true,
    });
    upsertTier.execute.mockResolvedValue(tier);

    const res = await request(app.getHttpServer())
      .put('/loyalty/club-subscription/tiers/ESSENCIAL')
      .send({ services: [{ serviceId: 'svc-1', quantity: 2 }], discountPercentage: 15, isActive: true });

    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('ESSENCIAL');
    expect(res.body.discountPercentage).toBe(15);
    expect(upsertTier.execute).toHaveBeenCalledWith({
      tenantId: 't1',
      tier: 'ESSENCIAL',
      services: [{ serviceId: 'svc-1', quantity: 2 }],
      discountPercentage: 15,
      isActive: true,
    });
  });

  it('PUT /loyalty/club-subscription/tiers/BOGUS rejects an invalid tier param with 400', async () => {
    app = await buildApp('ADMIN');

    const res = await request(app.getHttpServer())
      .put('/loyalty/club-subscription/tiers/BOGUS')
      .send({ services: [{ serviceId: 'svc-1', quantity: 2 }], discountPercentage: 15, isActive: true });

    expect(res.status).toBe(400);
    expect(upsertTier.execute).not.toHaveBeenCalled();
  });

  it('GET /loyalty/club-subscription/tiers returns serialized tiers as ADMIN', async () => {
    app = await buildApp('ADMIN');
    const tier = SubscriptionTier.create({
      tenantId: 't1',
      tier: 'JOGADOR',
      services: [{ serviceId: 'svc-2', quantity: 1 }],
      discountPercentage: 10,
      isActive: true,
    });
    getTiers.execute.mockResolvedValue([tier]);

    const res = await request(app.getHttpServer()).get('/loyalty/club-subscription/tiers');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].tier).toBe('JOGADOR');
    expect(getTiers.execute).toHaveBeenCalledWith({ tenantId: 't1' });
  });

  it('GET /loyalty/club-subscription/tiers/available returns tiers with computed price as CLIENT', async () => {
    app = await buildApp('CLIENT');
    getAvailableTiers.execute.mockResolvedValue([
      {
        id: 'tier-1',
        tier: 'ESSENCIAL',
        services: [{ serviceId: 'svc-1', quantity: 2, priceInCents: 3500 }],
        monthlyPriceInCents: 7000,
        discountPercentage: 0,
      },
    ]);

    const res = await request(app.getHttpServer()).get('/loyalty/club-subscription/tiers/available');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].monthlyPriceInCents).toBe(7000);
    expect(getAvailableTiers.execute).toHaveBeenCalledWith({ tenantId: 't1' });
  });

  it('GET /loyalty/club-subscription/tiers/available rejects ADMIN with 403', async () => {
    app = await buildApp('ADMIN');

    const res = await request(app.getHttpServer()).get('/loyalty/club-subscription/tiers/available');

    expect(res.status).toBe(403);
  });

  it('POST /loyalty/club-subscription/activate as CLIENT', async () => {
    app = await buildApp('CLIENT');
    const subscription = ClubSubscription.createNew({
      tenantId: 't1',
      clientId: 'user-1',
      tierId: 'tier-1',
      asaasCustomerId: 'cus_1',
      asaasSubscriptionId: 'sub_1',
      currentCycleStart: '2026-07-01',
      currentCycleEnd: '2026-07-31',
      quotas: [{ serviceId: 'svc-1', quantityTotal: 2, quantityConsumed: 0 }],
    });
    activate.execute.mockResolvedValue(subscription);

    const res = await request(app.getHttpServer())
      .post('/loyalty/club-subscription/activate')
      .send({ tier: 'ESSENCIAL', cpfCnpj: '12345678900', name: 'Fulano' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ACTIVE');
    expect(activate.execute).toHaveBeenCalledWith({
      tenantId: 't1',
      clientId: 'user-1',
      tier: 'ESSENCIAL',
      cpfCnpj: '12345678900',
      name: 'Fulano',
    });
  });

  it('GET /loyalty/club-subscription/me returns the serialized subscription as CLIENT', async () => {
    app = await buildApp('CLIENT');
    const subscription = ClubSubscription.createNew({
      tenantId: 't1',
      clientId: 'user-1',
      tierId: 'tier-1',
      asaasCustomerId: 'cus_1',
      asaasSubscriptionId: 'sub_1',
      currentCycleStart: '2026-07-01',
      currentCycleEnd: '2026-07-31',
      quotas: [{ serviceId: 'svc-1', quantityTotal: 2, quantityConsumed: 0 }],
    });
    getMySubscription.execute.mockResolvedValue(subscription);

    const res = await request(app.getHttpServer()).get('/loyalty/club-subscription/me');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.tierId).toBe('tier-1');
    expect(getMySubscription.execute).toHaveBeenCalledWith({ tenantId: 't1', clientId: 'user-1' });
  });

  it('POST /loyalty/club-subscription/cancel as CLIENT returns 204', async () => {
    app = await buildApp('CLIENT');
    cancelSubscription.execute.mockResolvedValue(undefined);

    const res = await request(app.getHttpServer()).post('/loyalty/club-subscription/cancel');

    expect(res.status).toBe(204);
    expect(cancelSubscription.execute).toHaveBeenCalledWith({ tenantId: 't1', clientId: 'user-1' });
  });

  it('rejects an activate body missing required fields', async () => {
    app = await buildApp('CLIENT');

    const res = await request(app.getHttpServer())
      .post('/loyalty/club-subscription/activate')
      .send({ tier: 'ESSENCIAL' });

    expect(res.status).toBe(400);
  });
});
