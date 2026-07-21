// apps/api/src/modules/loyalty/infra/gateways/asaas-payment.gateway.spec.ts
import { ConfigService } from '@nestjs/config';
import { AsaasPaymentGateway } from './asaas-payment.gateway';

describe('AsaasPaymentGateway', () => {
  function makeConfig() {
    return {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'ASAAS_API_URL') return 'https://api-sandbox.asaas.com/v3';
        if (key === 'ASAAS_API_KEY') return 'test-key';
        throw new Error(`unexpected key ${key}`);
      }),
    } as unknown as ConfigService;
  }

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('createCustomer posts to /customers and returns the customer id', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'cus_123' }),
    });
    const gateway = new AsaasPaymentGateway(makeConfig());
    const result = await gateway.createCustomer({ name: 'Fulano', cpfCnpj: '12345678900' });
    expect(result).toEqual({ customerId: 'cus_123' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api-sandbox.asaas.com/v3/customers',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ access_token: 'test-key' }),
      }),
    );
  });

  it('createSubscription converts cents to reais in the request body', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'sub_123' }),
    });
    const gateway = new AsaasPaymentGateway(makeConfig());
    await gateway.createSubscription({
      customerId: 'cus_123', billingType: 'PIX', valueInCents: 9350, nextDueDate: '2026-08-01',
    });
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.value).toBe(93.5);
    expect(body.cycle).toBe('MONTHLY');
  });

  it('throws on a non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 400, text: async () => 'bad request' });
    const gateway = new AsaasPaymentGateway(makeConfig());
    await expect(gateway.createCustomer({ name: 'x', cpfCnpj: '1' })).rejects.toThrow();
  });

  it('getPixQrCode GETs /payments/{id}/pixQrCode', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ encodedImage: 'img', payload: 'copia-e-cola', expirationDate: '2027-01-01' }),
    });
    const gateway = new AsaasPaymentGateway(makeConfig());
    const qr = await gateway.getPixQrCode('pay_123');
    expect(qr).toEqual({ encodedImage: 'img', payload: 'copia-e-cola', expirationDate: '2027-01-01' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api-sandbox.asaas.com/v3/payments/pay_123/pixQrCode',
      expect.objectContaining({ headers: expect.objectContaining({ access_token: 'test-key' }) }),
    );
  });

  it('cancelSubscription DELETEs /subscriptions/{id}', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    const gateway = new AsaasPaymentGateway(makeConfig());
    await gateway.cancelSubscription('sub_123');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api-sandbox.asaas.com/v3/subscriptions/sub_123',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
