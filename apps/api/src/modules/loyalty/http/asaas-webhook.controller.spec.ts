import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ConfigService } from '@nestjs/config';
import { AsaasWebhookController } from './asaas-webhook.controller';
import { HandlePaymentWebhookUseCase } from '../application/use-cases/handle-payment-webhook.use-case';

describe('AsaasWebhookController', () => {
  async function buildApp(webhookToken: string) {
    const moduleRef = await Test.createTestingModule({
      controllers: [AsaasWebhookController],
      providers: [
        { provide: HandlePaymentWebhookUseCase, useValue: { execute: jest.fn() } },
        { provide: ConfigService, useValue: { get: () => webhookToken } },
      ],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();
    await app.init();
    return app;
  }

  it('returns 401 when the access token header is wrong', async () => {
    const app = await buildApp('correct-token');
    await request(app.getHttpServer())
      .post('/loyalty/club-subscription/webhooks/asaas')
      .set('asaas-access-token', 'wrong-token')
      .send({ event: 'PAYMENT_RECEIVED', payment: { subscription: 'asaas_sub_1' } })
      .expect(401);
    await app.close();
  });

  it('returns 401 when the access token header is missing entirely', async () => {
    const app = await buildApp('correct-token');
    await request(app.getHttpServer())
      .post('/loyalty/club-subscription/webhooks/asaas')
      .send({ event: 'PAYMENT_RECEIVED', payment: { subscription: 'asaas_sub_1' } })
      .expect(401);
    await app.close();
  });

  it('processes the event and returns 200 when the token matches', async () => {
    const execute = jest.fn();
    const moduleRef = await Test.createTestingModule({
      controllers: [AsaasWebhookController],
      providers: [
        { provide: HandlePaymentWebhookUseCase, useValue: { execute } },
        { provide: ConfigService, useValue: { get: () => 'correct-token' } },
      ],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();
    await app.init();

    await request(app.getHttpServer())
      .post('/loyalty/club-subscription/webhooks/asaas')
      .set('asaas-access-token', 'correct-token')
      .send({ event: 'PAYMENT_RECEIVED', payment: { subscription: 'asaas_sub_1' } })
      .expect(200);

    expect(execute).toHaveBeenCalledWith({ event: 'PAYMENT_RECEIVED', subscriptionId: 'asaas_sub_1' });
    await app.close();
  });
});
