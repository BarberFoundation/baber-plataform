import { Test } from '@nestjs/testing';
import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { RolesGuard } from '@shared/auth/roles.guard';
import { PAYMENT_GATEWAY } from '../domain/ports/payment-gateway.port';
import { ClubSubscriptionController } from './club-subscription.controller';
import { CreateSubscriptionTierUseCase } from '../application/use-cases/create-subscription-tier.use-case';
import { UpdateSubscriptionTierUseCase } from '../application/use-cases/update-subscription-tier.use-case';
import { DeactivateSubscriptionTierUseCase } from '../application/use-cases/deactivate-subscription-tier.use-case';
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
  const createTier = { execute: jest.fn() };
  const updateTier = { execute: jest.fn() };
  const deactivateTier = { execute: jest.fn() };
  const getTiers = { execute: jest.fn() };
  const activate = { execute: jest.fn() };
  const getMySubscription = { execute: jest.fn() };
  const cancelSubscription = { execute: jest.fn() };
  const getAvailableTiers = { execute: jest.fn() };
  const paymentGateway = { getPaymentStatus: jest.fn() };

  async function buildApp(role: 'ADMIN' | 'CLIENT') {
    const moduleRef = await Test.createTestingModule({
      controllers: [ClubSubscriptionController],
      providers: [
        { provide: CreateSubscriptionTierUseCase, useValue: createTier },
        { provide: UpdateSubscriptionTierUseCase, useValue: updateTier },
        { provide: DeactivateSubscriptionTierUseCase, useValue: deactivateTier },
        { provide: GetSubscriptionTiersUseCase, useValue: getTiers },
        { provide: ActivateClubSubscriptionUseCase, useValue: activate },
        { provide: GetMyClubSubscriptionUseCase, useValue: getMySubscription },
        { provide: CancelClubSubscriptionUseCase, useValue: cancelSubscription },
        { provide: GetAvailableSubscriptionTiersUseCase, useValue: getAvailableTiers },
        { provide: PAYMENT_GATEWAY, useValue: paymentGateway },
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

  it('POST /loyalty/club-subscription/tiers creates as ADMIN', async () => {
    app = await buildApp('ADMIN');
    const tier = SubscriptionTier.create({
      tenantId: 't1', name: 'Essencial',
      services: [{ serviceId: 'svc-1', quantity: 2 }],
      discountPercentage: 15, isActive: true,
    });
    createTier.execute.mockResolvedValue(tier);

    const res = await request(app.getHttpServer())
      .post('/loyalty/club-subscription/tiers')
      .send({ name: 'Essencial', services: [{ serviceId: 'svc-1', quantity: 2 }], discountPercentage: 15 });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(tier.id);
    expect(res.body.name).toBe('Essencial');
    expect(createTier.execute).toHaveBeenCalledWith({
      tenantId: 't1',
      name: 'Essencial',
      services: [{ serviceId: 'svc-1', quantity: 2 }],
      discountPercentage: 15,
    });
  });

  it('POST /loyalty/club-subscription/tiers rejects CLIENT with 403', async () => {
    app = await buildApp('CLIENT');
    const res = await request(app.getHttpServer())
      .post('/loyalty/club-subscription/tiers')
      .send({ name: 'Essencial', services: [{ serviceId: 'svc-1', quantity: 2 }], discountPercentage: 15 });
    expect(res.status).toBe(403);
  });

  it('PUT /loyalty/club-subscription/tiers/:id updates as ADMIN', async () => {
    app = await buildApp('ADMIN');
    const tier = SubscriptionTier.create({
      id: '550e8400-e29b-41d4-a716-446655440000', tenantId: 't1', name: 'Essencial Plus',
      services: [{ serviceId: 'svc-1', quantity: 2 }],
      discountPercentage: 20, isActive: true,
    });
    updateTier.execute.mockResolvedValue(tier);

    const res = await request(app.getHttpServer())
      .put('/loyalty/club-subscription/tiers/550e8400-e29b-41d4-a716-446655440000')
      .send({ name: 'Essencial Plus', services: [{ serviceId: 'svc-1', quantity: 2 }], discountPercentage: 20 });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Essencial Plus');
    expect(updateTier.execute).toHaveBeenCalledWith({
      tenantId: 't1', id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Essencial Plus',
      services: [{ serviceId: 'svc-1', quantity: 2 }],
      discountPercentage: 20,
    });
  });

  it('PATCH /loyalty/club-subscription/tiers/:id/deactivate as ADMIN returns 204', async () => {
    app = await buildApp('ADMIN');
    deactivateTier.execute.mockResolvedValue(undefined);

    const res = await request(app.getHttpServer()).patch('/loyalty/club-subscription/tiers/550e8400-e29b-41d4-a716-446655440000/deactivate');

    expect(res.status).toBe(204);
    expect(deactivateTier.execute).toHaveBeenCalledWith({ tenantId: 't1', id: '550e8400-e29b-41d4-a716-446655440000' });
  });

  it('GET /loyalty/club-subscription/tiers returns serialized tiers as ADMIN', async () => {
    app = await buildApp('ADMIN');
    const tier = SubscriptionTier.create({
      tenantId: 't1',
      name: 'Ouro',
      services: [{ serviceId: 'svc-2', quantity: 1 }],
      discountPercentage: 10,
      isActive: true,
    });
    getTiers.execute.mockResolvedValue([tier]);

    const res = await request(app.getHttpServer()).get('/loyalty/club-subscription/tiers');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(tier.id);
    expect(res.body[0].name).toBe('Ouro');
    expect(getTiers.execute).toHaveBeenCalledWith({ tenantId: 't1' });
  });

  it('GET /loyalty/club-subscription/tiers/available returns tiers with computed price as CLIENT', async () => {
    app = await buildApp('CLIENT');
    getAvailableTiers.execute.mockResolvedValue([
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Essencial',
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
      tenantId: 't1', clientId: 'user-1', tierId: '550e8400-e29b-41d4-a716-446655440000',
      asaasCustomerId: 'cus_1', asaasSubscriptionId: 'sub_1',
      currentCycleStart: '2026-07-01', currentCycleEnd: '2026-07-31',
      quotas: [{ serviceId: 'svc-1', quantityTotal: 2, quantityConsumed: 0 }],
    });
    activate.execute.mockResolvedValue({ subscription, payment: null });

    const res = await request(app.getHttpServer())
      .post('/loyalty/club-subscription/activate')
      .send({ tierId: '550e8400-e29b-41d4-a716-446655440000', cpfCnpj: '12345678900', name: 'Fulano' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.payment).toBeNull();
    expect(activate.execute).toHaveBeenCalledWith({
      tenantId: 't1',
      clientId: 'user-1',
      tierId: '550e8400-e29b-41d4-a716-446655440000',
      cpfCnpj: '12345678900',
      name: 'Fulano',
    });
  });

  it('POST /loyalty/club-subscription/activate as CLIENT includes payment when a PIX charge was created', async () => {
    app = await buildApp('CLIENT');
    const subscription = ClubSubscription.createNew({
      tenantId: 't1', clientId: 'user-1', tierId: '550e8400-e29b-41d4-a716-446655440000',
      asaasCustomerId: 'cus_1', asaasSubscriptionId: 'sub_1',
      currentCycleStart: '2026-07-01', currentCycleEnd: '2026-07-31',
      quotas: [{ serviceId: 'svc-1', quantityTotal: 2, quantityConsumed: 0 }],
    });
    activate.execute.mockResolvedValue({
      subscription,
      payment: { paymentId: 'pay_1', pix: { encodedImage: 'img', payload: 'copia-e-cola', expirationDate: '2027-01-01' } },
    });

    const res = await request(app.getHttpServer())
      .post('/loyalty/club-subscription/activate')
      .send({ tierId: '550e8400-e29b-41d4-a716-446655440000', cpfCnpj: '12345678900', name: 'Fulano' });

    expect(res.status).toBe(201);
    expect(res.body.payment).toEqual({
      paymentId: 'pay_1',
      pix: { encodedImage: 'img', payload: 'copia-e-cola', expirationDate: '2027-01-01' },
    });
  });

  it('GET /loyalty/club-subscription/payments/:paymentId/status returns the gateway status as CLIENT', async () => {
    app = await buildApp('CLIENT');
    paymentGateway.getPaymentStatus.mockResolvedValue({ status: 'RECEIVED' });

    const res = await request(app.getHttpServer()).get('/loyalty/club-subscription/payments/pay_1/status');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'RECEIVED' });
    expect(paymentGateway.getPaymentStatus).toHaveBeenCalledWith('pay_1');
  });

  it('GET /loyalty/club-subscription/me returns the serialized subscription as CLIENT', async () => {
    app = await buildApp('CLIENT');
    const subscription = ClubSubscription.createNew({
      tenantId: 't1', clientId: 'user-1', tierId: '550e8400-e29b-41d4-a716-446655440000',
      asaasCustomerId: 'cus_1', asaasSubscriptionId: 'sub_1',
      currentCycleStart: '2026-07-01', currentCycleEnd: '2026-07-31',
      quotas: [{ serviceId: 'svc-1', quantityTotal: 2, quantityConsumed: 0 }],
    });
    getMySubscription.execute.mockResolvedValue(subscription);

    const res = await request(app.getHttpServer()).get('/loyalty/club-subscription/me');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.tierId).toBe('550e8400-e29b-41d4-a716-446655440000');
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
      .send({ cpfCnpj: '12345678900' });

    expect(res.status).toBe(400);
  });
});
